import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import type { IOrder } from '../models/Order';
import { s3Service } from '../services/s3Service';

export const orderController = {
  // Create new order
  createOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body;
        console.log(items);
      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ 
          message: 'Order must contain at least one item',
          error: 'Invalid items array'
        });
        return;
      }

      // Validate each item
      for (const item of items) {
        if (!item.product || !item.quantity || item.quantity < 1) {
          res.status(400).json({
            message: 'Each item must have a valid product ID and quantity',
            error: 'Invalid item format'
          });
          return;
        }
      }

      let totalAmount = 0;

      // Calculate total amount and set price at order
      const orderItems = await Promise.all(items.map(async (item: any) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        totalAmount += product.price * item.quantity;
        return {
          product: item.product,
          quantity: item.quantity,
          priceAtOrder: product.price
        };
      }));
      console.log(orderItems);

      const order = new Order({
        user: req.user?.userId,
        items: orderItems,
        totalAmount
      });

      await order.save();
      res.status(201).json(order);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: 'Error creating order', error });
    }
  },

  // Update order items
  updateOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body;
      const orderId = req.params.id;

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ 
          message: 'Order must contain at least one item',
          error: 'Invalid items array'
        });
        return;
      }

      // Validate each item
      for (const item of items) {
        if (!item.product || !item.quantity || item.quantity < 1) {
          res.status(400).json({
            message: 'Each item must have a valid product ID and quantity',
            error: 'Invalid item format'
          });
          return;
        }
      }

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Check if order can be updated
      if (!['pending', 'processing'].includes(order.status)) {
        res.status(400).json({ 
          message: 'Order cannot be updated at this stage' 
        });
        return;
      }

      let totalAmount = 0;

      // Calculate new total amount and update items
      const updatedItems = await Promise.all(items.map(async (item: any) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        totalAmount += product.price * item.quantity;
        return {
          product: item.product,
          quantity: item.quantity,
          priceAtOrder: product.price
        };
      }));

      // Update the order
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          items: updatedItems,
          totalAmount
        },
        { new: true }
      ).populate('items.product', 'name imageUrl price');

      // Generate presigned URLs for each product's image
      const itemsWithPresignedUrls = await Promise.all(
        updatedOrder!.items.map(async (item: any) => {
          const fileName = item.product.imageUrl.split('/').pop();
          const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
          return {
            ...item.toObject(),
            product: {
              ...item.product.toObject(),
              imageUrl: presignedUrl
            }
          };
        })
      );

      res.json({
        ...updatedOrder!.toObject(),
        items: itemsWithPresignedUrls
      });
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: 'Error updating order', error });
    }
  },

  // Get user's orders
  getUserOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await Order.find({ user: req.user?.userId })
        .populate('items.product', 'name imageUrl price')
        .sort({ createdAt: -1 });

      // Generate presigned URLs for each product's image
      const ordersWithPresignedUrls = await Promise.all(
        orders.map(async (order) => {
          const itemsWithPresignedUrls = await Promise.all(
            order.items.map(async (item: any) => {
              const fileName = item.product.imageUrl.split('/').pop();
              const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
              return {
                ...item.toObject(),
                product: {
                  ...item.product.toObject(),
                  imageUrl: presignedUrl
                }
              };
            })
          );
          return {
            ...order.toObject(),
            items: itemsWithPresignedUrls
          };
        })
      );

      res.json(ordersWithPresignedUrls);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching orders', error });
    }
  },

  // Get single order
  getOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        user: req.user?.userId
      }).populate('items.product', 'name imageUrl price');

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Generate presigned URLs for each product's image
      const itemsWithPresignedUrls = await Promise.all(
        order.items.map(async (item: any) => {
          const fileName = item.product.imageUrl.split('/').pop();
          const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
          return {
            ...item.toObject(),
            product: {
              ...item.product.toObject(),
              imageUrl: presignedUrl
            }
          };
        })
      );

      res.json({
        ...order.toObject(),
        items: itemsWithPresignedUrls
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching order', error });
    }
  },

  // Update order status (admin only)
  updateOrderStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.body;
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate('items.product', 'name imageUrl price');

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Generate presigned URLs for each product's image
      const itemsWithPresignedUrls = await Promise.all(
        order.items.map(async (item: any) => {
          const fileName = item.product.imageUrl.split('/').pop();
          const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
          return {
            ...item.toObject(),
            product: {
              ...item.product.toObject(),
              imageUrl: presignedUrl
            }
          };
        })
      );

      res.json({
        ...order.toObject(),
        items: itemsWithPresignedUrls
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating order', error });
    }
  },

  cancelOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason } = req.body;
      const order = await Order.findOne({
        _id: req.params.id,
        user: req.user?.userId
      }) as IOrder;

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Check if order can be cancelled
      if (!['pending', 'confirmed'].includes(order.status)) {
        res.status(400).json({ 
          message: 'Order cannot be cancelled at this stage' 
        });
        return;
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        order._id,
        {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date()
        },
        { new: true }
      ).populate('items.product', 'name imageUrl price');

      // Generate presigned URLs for each product's image
      const itemsWithPresignedUrls = await Promise.all(
        updatedOrder!.items.map(async (item: any) => {
          const fileName = item.product.imageUrl.split('/').pop();
          const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
          return {
            ...item.toObject(),
            product: {
              ...item.product.toObject(),
              imageUrl: presignedUrl
            }
          };
        })
      );

      res.json({ 
        message: 'Order cancelled successfully',
        order: {
          ...updatedOrder!.toObject(),
          items: itemsWithPresignedUrls
        }
      });
    } catch (error) {
      res.status(400).json({ message: 'Error cancelling order', error });
    }
  }
};