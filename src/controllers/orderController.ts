import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import Coupon from '../models/Coupon';
import Discount from '../models/Discount';
import Settings from '../models/Settings';
import Cart from '../models/Cart';
import type { IOrder } from '../models/Order';
import { s3Service } from '../services/s3Service';

export const orderController = {
  // Calculate order amount with pricing and coupons
  calculateOrderAmount: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, couponCode, preserveOriginalPricing } = req.body;
      console.log('Calculate order request:', { items, couponCode, preserveOriginalPricing });

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

      // Calculate subtotal and validate products
      let subtotal = 0;
      const orderItems = await Promise.all(items.map(async (item: any) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        subtotal += product.price * item.quantity;
        return {
          product: item.product,
          quantity: item.quantity,
          priceAtOrder: product.price
        };
      }));

      // Get pricing settings
      const pricingSettings = await Settings.findOne({ category: 'pricing' });
      const taxRate = pricingSettings?.value?.tax_rate || 0;
      const shippingCost = pricingSettings?.value?.shipping_cost || 0;
      const currency = pricingSettings?.value?.currency || 'INR';

      // Calculate tax and shipping
      const taxAmount = subtotal * taxRate;
      const totalWithTaxAndShipping = subtotal + taxAmount + shippingCost;

      // Validate and apply coupon if provided
      let appliedCoupon = null;
      let couponDiscount = 0;
      let amountAfterCoupon = totalWithTaxAndShipping;

      if (couponCode) {
        const coupon = await Coupon.findOne({ 
          code: couponCode.toUpperCase(),
          isActive: true,
          validFrom: { $lte: new Date() },
          validUntil: { $gte: new Date() }
        });

        if (!coupon) {
          res.status(400).json({ 
            message: 'Invalid or expired coupon code',
            error: 'Coupon not found or inactive'
          });
          return;
        }

        // Check usage limit before applying
        if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
          res.status(400).json({ 
            message: 'Coupon usage limit has been reached',
            error: 'Coupon usage limit exceeded'
          });
          return;
        }

        // Check minimum order amount
        if (coupon.minimumOrderAmount && subtotal < coupon.minimumOrderAmount) {
          res.status(400).json({ 
            message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required for this coupon`,
            error: 'Minimum order amount not met'
          });
          return;
        }

        // Calculate coupon discount
        if (coupon.discountType === 'percentage') {
          couponDiscount = subtotal * (coupon.discountValue / 100);
          if (coupon.maximumDiscount) {
            couponDiscount = Math.min(couponDiscount, coupon.maximumDiscount);
          }
        } else {
          couponDiscount = coupon.discountValue;
        }

        amountAfterCoupon = totalWithTaxAndShipping - couponDiscount;
        
        appliedCoupon = {
          coupon: {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
          },
          discountAmount: couponDiscount
        };
      }

      // Calculate automatic discounts for pending/processing orders
      let automaticDiscounts = [];
      let totalAutomaticDiscount = 0;
      let finalTotal = amountAfterCoupon;

      // Only apply automatic discounts if NOT preserving original pricing
      // This means: original order had discounts, so apply current rules
      // If preserveOriginalPricing is true (no original discounts), automatic discounts are NOT applied
      // even if a new coupon is being applied
      console.log('🔍 calculateOrderAmount - preserveOriginalPricing:', preserveOriginalPricing, 'couponCode:', couponCode);
      if (!preserveOriginalPricing) {
        const now = new Date();
        const activeDiscounts = await Discount.find({
          isActive: true,
          validFrom: { $lte: now },
          validUntil: { $gte: now }
        });

        console.log('🔍 Found', activeDiscounts.length, 'active discounts');
        for (const discount of activeDiscounts) {
          // Use model's validation method
          const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const validation = discount.canBeApplied(amountAfterCoupon, totalQuantity);
          
          console.log('🔍 Discount', discount.name, '- canBeApplied:', validation.valid, 'reason:', validation.reason);
          
          if (!validation.valid) {
            continue;
          }

          // Calculate discount amount using model method
          const discountAmount = discount.calculateDiscount(amountAfterCoupon, totalQuantity);
          console.log('🔍 Discount', discount.name, '- calculated amount:', discountAmount);

          if (discountAmount > 0) {
            automaticDiscounts.push({
              discount: {
                _id: discount._id,
                name: discount.name,
                type: discount.type,
                value: discount.value
              },
              discountAmount
            });
            totalAutomaticDiscount += discountAmount;
          }
        }
        console.log('🔍 Final automatic discounts:', automaticDiscounts.length, 'total amount:', totalAutomaticDiscount);

        finalTotal = amountAfterCoupon - totalAutomaticDiscount;
      }

      // Return pricing breakdown
      const response = {
        subtotal,
        taxRate,
        taxAmount,
        shippingCost,
        discountAmount: couponDiscount + totalAutomaticDiscount,
        couponDiscount,
        amountAfterCoupon,
        automaticDiscounts,
        totalAutomaticDiscount,
        finalTotal,
        appliedCoupon
      };
      
      console.log('🔍 Final response - automaticDiscounts:', response.automaticDiscounts.length, 'totalAutomaticDiscount:', response.totalAutomaticDiscount);
      res.json(response);
    } catch (error) {
      console.error('Error calculating order amount:', error);
      res.status(400).json({ message: 'Error calculating order amount', error: (error as Error).message });
    }
  },

  // Create new order
  createOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, couponCode, shippingDetails, paymentDetails } = req.body;
      console.log('Order request:', { items, couponCode, shippingDetails, paymentDetails });

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

      // Calculate subtotal and validate products
      let subtotal = 0;
      const orderItems = await Promise.all(items.map(async (item: any) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        subtotal += product.price * item.quantity;
        return {
          product: item.product,
          quantity: item.quantity,
          priceAtOrder: product.price
        };
      }));

      // Get pricing settings
      const pricingSettings = await Settings.findOne({ category: 'pricing' });
      const taxRate = pricingSettings?.value?.tax_rate || 0;
      const shippingCost = pricingSettings?.value?.shipping_cost || 0;
      const currency = pricingSettings?.value?.currency || 'INR';

      // Calculate tax and shipping
      const taxAmount = subtotal * taxRate;
      const totalWithTaxAndShipping = subtotal + taxAmount + shippingCost;

      // Validate and apply coupon if provided
      let appliedCoupon = null;
      let discountAmount = 0;
      let finalTotal = totalWithTaxAndShipping;

      if (couponCode) {
        const coupon = await Coupon.findOne({ 
          code: couponCode.toUpperCase(),
          isActive: true,
          validFrom: { $lte: new Date() },
          validUntil: { $gte: new Date() }
        });

        if (!coupon) {
          res.status(400).json({ 
            message: 'Invalid or expired coupon code',
            error: 'Coupon not found or inactive'
          });
          return;
        }

        // Check minimum order amount
        if (coupon.minimumOrderAmount && subtotal < coupon.minimumOrderAmount) {
          res.status(400).json({ 
            message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required for this coupon`,
            error: 'Minimum order amount not met'
          });
          return;
        }

        // Check usage limits
        if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
          res.status(400).json({ 
            message: 'Coupon usage limit exceeded',
            error: 'Coupon usage limit reached'
          });
          return;
        }

        // Calculate discount
        if (coupon.discountType === 'percentage') {
          discountAmount = subtotal * (coupon.discountValue / 100);
          if (coupon.maximumDiscount) {
            discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
          }
        } else {
          discountAmount = coupon.discountValue;
        }

        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, subtotal);

        finalTotal = totalWithTaxAndShipping - discountAmount;
        appliedCoupon = {
          couponId: coupon._id,
          code: coupon.code,
          discountAmount: discountAmount
        };

        // Increment usage count
        await coupon.incrementUsage();
      }

      // Calculate and apply automatic discounts on amount AFTER coupon discount
      const amountAfterCoupon = subtotal - discountAmount;
      const now = new Date();
      const activeDiscounts = await Discount.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      });

      let automaticDiscounts = [];
      let totalAutomaticDiscount = 0;

      for (const discount of activeDiscounts) {
        // Use model's validation method on amount after coupon
        const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const validation = discount.canBeApplied(amountAfterCoupon, totalQuantity);
        
        if (!validation.valid) {
          res.status(400).json({ 
            message: validation.reason,
            error: 'Discount validation failed'
          });
          return;
        }

        // Calculate discount amount using model method on amount after coupon
        const discountAmount = discount.calculateDiscount(amountAfterCoupon, totalQuantity);

        if (discountAmount > 0) {
          automaticDiscounts.push({
            discount: {
              _id: discount._id,
              name: discount.name,
              type: discount.type,
              value: discount.value
            },
            discountAmount
          });
          totalAutomaticDiscount += discountAmount;
          
          // Increment usage count for the discount (only when order is placed)
          await discount.incrementUsage();
        }
      }

      // Calculate final total with both coupon and automatic discounts
      const totalDiscount = discountAmount + totalAutomaticDiscount;
      finalTotal = totalWithTaxAndShipping - totalDiscount;

      // Create order with all calculated values
      const order = new Order({
        user: req.user?.userId,
        items: orderItems,
        shippingDetails: shippingDetails || {
          type: 'take-in',
          address: 'Store Pickup',
          city: 'Local Store',
          state: 'Andhra Pradesh',
          zipCode: '500000',
          country: 'India'
        },
        paymentDetails: paymentDetails || {
          method: 'COD',
          status: 'pending'
        },
        pricing: {
          subtotal: subtotal,
          taxRate: taxRate,
          taxAmount: taxAmount,
          shippingCost: shippingCost,
          discountAmount: totalDiscount,
          discountCode: appliedCoupon?.code || '',
          totalAmount: finalTotal
        },
        appliedCoupon: appliedCoupon,
        automaticDiscounts: automaticDiscounts,
        totalAmount: finalTotal,
        status: 'pending'
      });

      await order.save();
      
      // Clear user's cart after successful order placement
      const userCart = await Cart.findOne({ user: req.user?.userId, isActive: true });
      if (userCart) {
        await userCart.clearCart();
      }
      
      console.log('Order created successfully:', {
        orderId: order._id,
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount,
        finalTotal
      });

      res.status(201).json(order);
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(400).json({ message: 'Error creating order', error: (error as Error).message });
    }
  },

  // Update order items
  updateOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, couponCode } = req.body;
      const orderId = req.params.id;

      console.log('🔍 updateOrder called with:', { orderId, items: items?.length, couponCode, userId: req.user?.userId });

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        console.log('🔍 Validation failed: Invalid items array');
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
        console.log('🔍 Order not found:', orderId);
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      console.log('🔍 Found order:', orderId, 'status:', order.status, 'orderUser:', order.user, 'requestUser:', req.user?.userId);

      // Check if user can edit this order (own order or admin)
      if (order.user.toString() !== req.user?.userId && req.user?.role !== 'admin') {
        console.log('🔍 User cannot edit this order - not owner and not admin');
        res.status(403).json({ 
          message: 'You can only edit your own orders' 
        });
        return;
      }

      // Check if order can be updated
      if (!['pending', 'processing'].includes(order.status)) {
        console.log('🔍 Order cannot be updated, status:', order.status);
        res.status(400).json({ 
          message: 'Order cannot be updated at this stage' 
        });
        return;
      }

      // Calculate updated items first
      const updatedItems = await Promise.all(items.map(async (item: any) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        return {
          product: item.product,
          quantity: item.quantity,
          priceAtOrder: product.price
        };
      }));

      // For completed/delivered orders, preserve original pricing
      if (['confirmed', 'delivered'].includes(order.status)) {
        // Only update items, preserve all original pricing
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { items: updatedItems },
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
        return;
      }

      // Check if the original order had any discounts or coupons
      const originalOrderHadDiscounts = order.appliedCoupon || 
                                       (order.automaticDiscounts && order.automaticDiscounts.length > 0) ||
                                       (order.pricing && order.pricing.discountAmount > 0);

      // SCENARIO 1: No coupon being applied AND original order had no discounts
      // → Preserve original pricing structure (no automatic discounts)
      if (!couponCode && !originalOrderHadDiscounts) {
        // Preserve original pricing structure - only update items
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { items: updatedItems },
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
        return;
      }

      // Get pricing settings
      const pricingSettings = await Settings.findOne({ category: 'pricing' });
      const taxRate = pricingSettings?.value?.tax_rate || 0;
      const shippingCost = pricingSettings?.value?.shipping_cost || 0;

      // Calculate total amount for pricing recalculation
      let totalAmount = 0;
      updatedItems.forEach(item => {
        totalAmount += item.priceAtOrder * item.quantity;
      });

      // Calculate tax and shipping
      const taxAmount = totalAmount * taxRate;
      const totalWithTaxAndShipping = totalAmount + taxAmount + shippingCost;

      // Handle coupon if provided
      let appliedCoupon = undefined;
      let couponDiscount = 0;
      let amountAfterCoupon = totalWithTaxAndShipping;

      if (couponCode && couponCode.trim()) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        if (coupon && coupon.isActive) {
          // Check if coupon can be used
          const validation = coupon.canBeUsed(totalWithTaxAndShipping);
          if (validation.valid) {
            couponDiscount = coupon.calculateDiscount(totalWithTaxAndShipping);
            amountAfterCoupon = totalWithTaxAndShipping - couponDiscount;
            
            appliedCoupon = {
              couponId: coupon._id,
              code: coupon.code,
              discountAmount: couponDiscount
            };
          }
        }
      }

      // Calculate automatic discounts ONLY if the original order had discounts
      let automaticDiscounts = [];
      let totalAutomaticDiscount = 0;

      // Only apply automatic discounts if the original order already had them
      // NOT just because a new coupon is being applied
      // This ensures that simple orders stay simple even when coupons are added
      if (originalOrderHadDiscounts) {
        // The original order had discounts, so apply current automatic discount rules
        const now = new Date();
        const activeDiscounts = await Discount.find({
          isActive: true,
          validFrom: { $lte: now },
          validUntil: { $gte: now }
        });

        for (const discount of activeDiscounts) {
          // Use model's validation method
          const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const validation = discount.canBeApplied(amountAfterCoupon, totalQuantity);
          
          if (!validation.valid) {
            continue;
          }

          // Calculate discount amount using model method
          const discountAmount = discount.calculateDiscount(amountAfterCoupon, totalQuantity);

          if (discountAmount > 0) {
            automaticDiscounts.push({
              discount: {
                _id: discount._id,
                name: discount.name,
                type: discount.type,
                value: discount.value
              },
              discountAmount
            });
            totalAutomaticDiscount += discountAmount;
          }
        }
      }

      // Calculate final total with all discounts
      const finalTotal = amountAfterCoupon - totalAutomaticDiscount;

      // Update the order with all calculated values
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          items: updatedItems,
          totalAmount: finalTotal,
          pricing: {
            subtotal: totalAmount,
            taxRate: taxRate,
            taxAmount: taxAmount,
            shippingCost: shippingCost,
            discountAmount: couponDiscount + totalAutomaticDiscount,
            discountCode: couponCode || '',
            totalAmount: finalTotal
          },
          appliedCoupon: appliedCoupon,
          automaticDiscounts: automaticDiscounts
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

      console.log('🔍 Order updated successfully:', orderId);
      res.json({
        ...updatedOrder!.toObject(),
        items: itemsWithPresignedUrls
      });
    } catch (error) {
      console.error('🔍 Error updating order:', error);
      res.status(400).json({ message: 'Error updating order', error });
    }
  },

  // Get user's orders
  getUserOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await Order.find({ user: req.user?.userId })
        .populate('items.product', 'name imageUrl price')
        .populate('user', 'email firstName lastName')
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

  // Get all orders (admin only)
  getAllOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('🔍 getAllOrders - req.user:', req.user);
      console.log('🔍 getAllOrders - user role:', req.user?.role);
      
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        console.log('🔍 Access denied - user role is not admin:', req.user?.role);
        res.status(403).json({ message: 'Access denied. Admin role required.' });
        return;
      }

      const orders = await Order.find({})
        .populate('items.product', 'name imageUrl price')
        .populate('user', 'email firstName lastName')
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
      res.status(500).json({ message: 'Error fetching all orders', error });
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