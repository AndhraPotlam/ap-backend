import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { s3Service } from '../services/s3Service';
import { formatDoc, formatDocs } from '../utils/format';

async function recalculateCart(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
  });

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.priceAtAdd, 0);

  return prisma.cart.update({
    where: { id: cartId },
    data: {
      totalItems,
      totalPrice,
    },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, price: true, imageUrl: true },
          },
        },
      },
    },
  });
}

export const cartController = {
  // Get user's cart
  getCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      let cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true, imageUrl: true },
              },
            },
          },
        },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId,
            isActive: true,
            totalPrice: 0,
            totalItems: 0,
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, price: true, imageUrl: true },
                },
              },
            },
          },
        });
      }

      const itemsWithPresignedUrls = await Promise.all(
        cart.items.map(async (item) => {
          let resolvedImageUrl = item.product.imageUrl;
          if (item.product?.imageUrl) {
            try {
              if (s3Service.isConfigured()) {
                const fileName = item.product.imageUrl.split('/').pop();
                if (fileName) resolvedImageUrl = await s3Service.getReadPresignedUrl(fileName);
              } else {
                const fileName = item.product.imageUrl.split('/').pop();
                if (fileName) resolvedImageUrl = s3Service.getImageUrl(fileName);
              }
            } catch (err) {
              // fallback
            }
          }
          return {
            ...item,
            _id: item.id,
            product: {
              ...item.product,
              _id: item.product.id,
              imageUrl: resolvedImageUrl,
            },
          };
        })
      );

      res.json({
        ...cart,
        _id: cart.id,
        items: itemsWithPresignedUrls,
      });
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Failed to fetch cart', error: error.message });
    }
  },

  // Add item to cart
  addToCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!productId || !quantity || quantity < 1) {
        res.status(400).json({ message: 'Product ID and valid quantity are required' });
        return;
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      let cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId,
            isActive: true,
            totalPrice: 0,
            totalItems: 0,
          },
        });
      }

      const existingItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, productId },
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + Number(quantity) },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity: Number(quantity),
            priceAtAdd: product.price,
          },
        });
      }

      const updatedCart = await recalculateCart(cart.id);

      const itemsWithPresignedUrls = await Promise.all(
        updatedCart.items.map(async (item) => {
          let resolvedImageUrl = item.product.imageUrl;
          if (item.product?.imageUrl) {
            try {
              if (s3Service.isConfigured()) {
                const fileName = item.product.imageUrl.split('/').pop();
                if (fileName) resolvedImageUrl = await s3Service.getReadPresignedUrl(fileName);
              }
            } catch (err) {}
          }
          return {
            ...item,
            _id: item.id,
            product: {
              ...item.product,
              _id: item.product.id,
              imageUrl: resolvedImageUrl,
            },
          };
        })
      );

      res.json({
        message: 'Item added to cart successfully',
        cart: {
          ...updatedCart,
          _id: updatedCart.id,
          items: itemsWithPresignedUrls,
        },
      });
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Failed to add item to cart', error: error.message });
    }
  },

  // Update item quantity
  updateQuantity: async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!productId || quantity === undefined) {
        res.status(400).json({ message: 'Product ID and quantity are required' });
        return;
      }

      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        res.status(404).json({ message: 'Cart not found' });
        return;
      }

      const existingItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, productId },
      });

      if (existingItem) {
        if (Number(quantity) <= 0) {
          await prisma.cartItem.delete({ where: { id: existingItem.id } });
        } else {
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: Number(quantity) },
          });
        }
      }

      const updatedCart = await recalculateCart(cart.id);

      res.json({
        message: 'Cart updated successfully',
        cart: {
          ...updatedCart,
          _id: updatedCart.id,
          items: updatedCart.items.map((i) => ({
            ...i,
            _id: i.id,
            product: { ...i.product, _id: i.product.id },
          })),
        },
      });
    } catch (error: any) {
      console.error('Error updating cart:', error);
      res.status(500).json({ message: 'Failed to update cart', error: error.message });
    }
  },

  // Remove item from cart
  removeFromCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId } = req.params;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        res.status(404).json({ message: 'Cart not found' });
        return;
      }

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });

      const updatedCart = await recalculateCart(cart.id);

      res.json({
        message: 'Item removed from cart successfully',
        cart: {
          ...updatedCart,
          _id: updatedCart.id,
          items: updatedCart.items.map((i) => ({
            ...i,
            _id: i.id,
            product: { ...i.product, _id: i.product.id },
          })),
        },
      });
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ message: 'Failed to remove item from cart', error: error.message });
    }
  },

  // Apply coupon
  applyCoupon: async (req: Request, res: Response): Promise<void> => {
    try {
      const { couponCode } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!couponCode) {
        res.status(400).json({ message: 'Coupon code is required' });
        return;
      }

      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        res.status(404).json({ message: 'Cart not found' });
        return;
      }

      const coupon = await prisma.coupon.findUnique({
        where: { code: String(couponCode).trim().toUpperCase() },
      });

      if (!coupon || !coupon.isActive) {
        res.status(400).json({ message: 'Invalid or inactive coupon' });
        return;
      }

      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (cart.totalPrice * coupon.discountValue) / 100;
        if (coupon.maximumDiscount && discountAmount > coupon.maximumDiscount) {
          discountAmount = coupon.maximumDiscount;
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: {
          appliedCouponId: coupon.id,
          appliedCouponCode: coupon.code,
          appliedDiscountAmount: discountAmount,
        },
      });

      res.json({
        message: 'Coupon applied successfully',
        cart: formatDoc(updatedCart),
      });
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      res.status(500).json({ message: 'Failed to apply coupon', error: error.message });
    }
  },

  // Clear cart
  clearCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        res.status(404).json({ message: 'Cart not found' });
        return;
      }

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: {
          totalItems: 0,
          totalPrice: 0,
          appliedCouponId: null,
          appliedCouponCode: null,
          appliedDiscountAmount: null,
        },
      });

      res.json({
        message: 'Cart cleared successfully',
        cart: formatDoc(updatedCart),
      });
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Failed to clear cart', error: error.message });
    }
  },
};
