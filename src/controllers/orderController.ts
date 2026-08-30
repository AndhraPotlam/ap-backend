import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { s3Service } from '../services/s3Service';
import { formatDoc, formatDocs } from '../utils/format';

function formatOrder(order: any) {
  if (!order) return null;
  return {
    ...order,
    _id: order.id,
    shippingDetails: {
      type: order.shippingType,
      address: order.shippingAddress,
      city: order.shippingCity,
      state: order.shippingState,
      zipCode: order.shippingZipCode,
      country: order.shippingCountry,
    },
    paymentDetails: {
      method: order.paymentMethod,
      status: order.paymentStatus,
    },
    pricing: {
      subtotal: order.subtotal,
      taxRate: order.taxRate,
      taxAmount: order.taxAmount,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      discountCode: order.discountCode || '',
      totalAmount: order.totalAmount,
    },
    items: order.items?.map((item: any) => ({
      ...item,
      _id: item.id,
      product: item.product ? { ...item.product, _id: item.product.id } : item.productId,
    })) || [],
    user: order.user ? { ...order.user, _id: order.user.id } : order.userId,
  };
}

export const orderController = {
  // Calculate order amount with pricing and coupons
  calculateOrderAmount: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, couponCode } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'Order must contain at least one item' });
        return;
      }

      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const productId = typeof item.product === 'object' ? item.product?.id || item.product?._id : item.product;
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          res.status(404).json({ message: `Product ${productId} not found` });
          return;
        }

        const quantity = Number(item.quantity) || 1;
        subtotal += product.price * quantity;
        orderItems.push({
          product: formatDoc(product),
          productId: product.id,
          quantity,
          priceAtOrder: product.price,
        });
      }

      const pricingSetting = await prisma.setting.findUnique({
        where: { key: 'pricing' },
      });
      const pricingVal: any = pricingSetting?.value || {};
      const taxRate = Number(pricingVal.tax_rate) || 0;
      const shippingCost = Number(pricingVal.shipping_cost) || 0;
      const currency = pricingVal.currency || 'INR';

      const taxAmount = subtotal * taxRate;
      let totalAmount = subtotal + taxAmount + shippingCost;

      let appliedCoupon = null;
      let discountAmount = 0;

      if (couponCode) {
        const coupon = await prisma.coupon.findFirst({
          where: {
            code: String(couponCode).trim().toUpperCase(),
            isActive: true,
            validFrom: { lte: new Date() },
            validUntil: { gte: new Date() },
          },
        });

        if (coupon) {
          if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maximumDiscount && discountAmount > coupon.maximumDiscount) {
              discountAmount = coupon.maximumDiscount;
            }
          } else {
            discountAmount = coupon.discountValue;
          }
          appliedCoupon = formatDoc(coupon);
        }
      }

      totalAmount = Math.max(0, totalAmount - discountAmount);

      res.json({
        subtotal,
        taxRate,
        taxAmount,
        shippingCost,
        discountAmount,
        totalAmount,
        currency,
        items: orderItems,
        appliedCoupon,
      });
    } catch (error: any) {
      console.error('Error calculating order amount:', error);
      res.status(500).json({ message: 'Error calculating order amount', error: error.message });
    }
  },

  // Create order
  createOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, shippingDetails, paymentDetails, couponCode } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'Order must contain at least one item' });
        return;
      }

      let subtotal = 0;
      const resolvedItems: Array<{ productId: string; quantity: number; priceAtOrder: number }> = [];

      for (const item of items) {
        const productId = typeof item.product === 'object' ? item.product?.id || item.product?._id : item.product;
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          res.status(404).json({ message: `Product ${productId} not found` });
          return;
        }

        const quantity = Number(item.quantity) || 1;
        subtotal += product.price * quantity;
        resolvedItems.push({
          productId: product.id,
          quantity,
          priceAtOrder: product.price,
        });
      }

      const pricingSetting = await prisma.setting.findUnique({
        where: { key: 'pricing' },
      });
      const pricingVal: any = pricingSetting?.value || {};
      const taxRate = Number(pricingVal.tax_rate) || 0;
      const shippingCost = Number(pricingVal.shipping_cost) || 0;
      const taxAmount = subtotal * taxRate;
      let discountAmount = 0;
      let couponRecord = null;

      if (couponCode) {
        couponRecord = await prisma.coupon.findFirst({
          where: {
            code: String(couponCode).trim().toUpperCase(),
            isActive: true,
          },
        });

        if (couponRecord) {
          if (couponRecord.discountType === 'percentage') {
            discountAmount = (subtotal * couponRecord.discountValue) / 100;
            if (couponRecord.maximumDiscount) {
              discountAmount = Math.min(discountAmount, couponRecord.maximumDiscount);
            }
          } else {
            discountAmount = couponRecord.discountValue;
          }
        }
      }

      const totalAmount = Math.max(0, subtotal + taxAmount + shippingCost - discountAmount);

      const newOrder = await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            userId,
            totalAmount,
            status: 'pending',
            shippingType: shippingDetails?.type || 'standard',
            shippingAddress: shippingDetails?.address || '',
            shippingCity: shippingDetails?.city || '',
            shippingState: shippingDetails?.state || '',
            shippingZipCode: shippingDetails?.zipCode || '',
            shippingCountry: shippingDetails?.country || 'India',
            paymentMethod: paymentDetails?.method || 'online',
            paymentStatus: paymentDetails?.status || 'pending',
            subtotal,
            taxRate,
            taxAmount,
            shippingCost,
            discountAmount,
            discountCode: couponCode || null,
            appliedCoupon: couponRecord ? (formatDoc(couponRecord) as any) : undefined,
            items: {
              create: resolvedItems.map((ri) => ({
                productId: ri.productId,
                quantity: ri.quantity,
                priceAtOrder: ri.priceAtOrder,
              })),
            },
          },
          include: {
            items: {
              include: { product: true },
            },
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
            },
          },
        });

        // Reduce stock
        for (const ri of resolvedItems) {
          await tx.product.update({
            where: { id: ri.productId },
            data: { stock: { decrement: ri.quantity } },
          });
        }

        // Clear user cart
        const userCart = await tx.cart.findUnique({ where: { userId } });
        if (userCart) {
          await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
          await tx.cart.update({
            where: { id: userCart.id },
            data: { totalItems: 0, totalPrice: 0 },
          });
        }

        return createdOrder;
      });

      res.status(201).json(formatOrder(newOrder));
    } catch (error: any) {
      console.error('Error creating order:', error);
      res.status(500).json({ message: 'Error creating order', error: error.message });
    }
  },

  // Update order
  updateOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, cancellationReason, paymentStatus } = req.body;

      const order = await prisma.order.update({
        where: { id },
        data: {
          status: status || undefined,
          cancellationReason: cancellationReason || undefined,
          paymentStatus: paymentStatus || undefined,
          cancelledAt: status === 'cancelled' ? new Date() : undefined,
        },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        },
      });

      res.json(formatOrder(order));
    } catch (error: any) {
      console.error('Error updating order:', error);
      res.status(500).json({ message: 'Error updating order', error: error.message });
    }
  },

  // Get user's orders
  getUserOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const orders = await prisma.order.findMany({
        where: { userId },
        include: {
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(orders.map(formatOrder));
    } catch (error: any) {
      console.error('Error fetching user orders:', error);
      res.status(500).json({ message: 'Error fetching user orders', error: error.message });
    }
  },

  // Get all orders (Admin)
  getAllOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, status } = req.query;

      const whereClause: any = {};
      if (status) whereClause.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: whereClause,
          include: {
            items: { include: { product: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.order.count({ where: whereClause }),
      ]);

      res.json({
        orders: orders.map(formatOrder),
        currentPage: Number(page),
        totalPages: Math.ceil(total / take),
        totalOrders: total,
      });
    } catch (error: any) {
      console.error('Error fetching all orders:', error);
      res.status(500).json({ message: 'Error fetching all orders', error: error.message });
    }
  },

  // Get single order
  getOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        },
      });

      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      res.json(formatOrder(order));
    } catch (error: any) {
      console.error('Error fetching order:', error);
      res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
  },

  // Update order status
  updateOrderStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        },
      });

      res.json(formatOrder(order));
    } catch (error: any) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
  },

  // Cancel order
  cancelOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body;

      const order = await prisma.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancellationReason: cancellationReason || 'Cancelled by user/admin',
          cancelledAt: new Date(),
        },
        include: {
          items: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        },
      });

      res.json(formatOrder(order));
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      res.status(500).json({ message: 'Error cancelling order', error: error.message });
    }
  },
};