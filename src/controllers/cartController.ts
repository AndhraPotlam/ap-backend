import { Request, Response } from 'express';
import Cart from '../models/Cart';
import { Product } from '../models/Product';
import { s3Service } from '../services/s3Service';

export const cartController = {
  // Get user's cart
  getCart: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      let cart = await Cart.findOne({ user: userId, isActive: true })
        .populate('items.product', 'name price imageUrl')
        .populate('appliedCoupon.couponId', 'name code discountType discountValue');

      if (!cart) {
        // Check if there's an inactive cart for this user
        const inactiveCart = await Cart.findOne({ user: userId, isActive: false });
        
        if (inactiveCart) {
          // Reactivate the existing cart
          inactiveCart.isActive = true;
          inactiveCart.items = [];
          inactiveCart.totalPrice = 0;
          inactiveCart.totalItems = 0;
          inactiveCart.appliedCoupon = undefined;
          await inactiveCart.save();
          cart = inactiveCart;
        } else {
          // Create new cart only if no cart exists at all
          cart = new Cart({
            user: userId,
            items: [],
            totalPrice: 0,
            totalItems: 0,
            isActive: true
          });
          await cart.save();
        }
      }

      // Generate presigned URLs for product images
      const itemsWithPresignedUrls = await Promise.all(
        cart.items.map(async (item: any) => {
          if (item.product && item.product.imageUrl) {
            try {
              const fileName = item.product.imageUrl.split('/').pop();
              const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
              return {
                ...item.toObject(),
                product: {
                  ...item.product.toObject(),
                  imageUrl: presignedUrl
                }
              };
            } catch (error) {
              console.error('Error generating presigned URL:', error);
              return item.toObject();
            }
          }
          return item.toObject();
        })
      );

      res.json({
        ...cart.toObject(),
        items: itemsWithPresignedUrls
      });
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Failed to fetch cart' });
    }
  },

  // Add item to cart
  addToCart: async (req: Request, res: Response) => {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user?.userId;

      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ message: 'Product ID and valid quantity are required' });
      }

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Get or create cart
      let cart = await Cart.findOne({ user: userId, isActive: true });
      if (!cart) {
        // Check if there's an inactive cart for this user
        const inactiveCart = await Cart.findOne({ user: userId, isActive: false });
        
        if (inactiveCart) {
          // Reactivate the existing cart
          inactiveCart.isActive = true;
          inactiveCart.items = [];
          inactiveCart.totalPrice = 0;
          inactiveCart.totalItems = 0;
          inactiveCart.appliedCoupon = undefined;
          await inactiveCart.save();
          cart = inactiveCart;
        } else {
          // Create new cart only if no cart exists at all
          cart = new Cart({
            user: userId,
            items: [],
            totalPrice: 0,
            totalItems: 0,
            isActive: true
          });
          await cart.save();
        }
      }

      // Add item to cart
      await cart.addItem(productId, quantity, product.price);

      // Populate and return updated cart
      const updatedCart = await Cart.findById(cart._id)
        .populate('items.product', 'name price imageUrl')
        .populate('appliedCoupon.couponId', 'name code discountType discountValue');

      res.json({
        message: 'Item added to cart successfully',
        cart: updatedCart
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Failed to add item to cart' });
    }
  },

  // Update item quantity
  updateQuantity: async (req: Request, res: Response) => {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user?.userId;

      if (!productId || quantity === undefined) {
        return res.status(400).json({ message: 'Product ID and quantity are required' });
      }

      const cart = await Cart.findOne({ user: userId, isActive: true });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      await cart.updateItemQuantity(productId, quantity);

      // Populate and return updated cart
      const updatedCart = await Cart.findById(cart._id)
        .populate('items.product', 'name price imageUrl')
        .populate('appliedCoupon.couponId', 'name code discountType discountValue');

      res.json({
        message: 'Cart updated successfully',
        cart: updatedCart
      });
    } catch (error) {
      console.error('Error updating cart:', error);
      res.status(500).json({ message: 'Failed to update cart' });
    }
  },

  // Remove item from cart
  removeFromCart: async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const userId = req.user?.userId;

      const cart = await Cart.findOne({ user: userId, isActive: true });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      await cart.removeItem(productId);

      // Populate and return updated cart
      const updatedCart = await Cart.findById(cart._id)
        .populate('items.product', 'name price imageUrl')
        .populate('appliedCoupon.couponId', 'name code discountType discountValue');

      res.json({
        message: 'Item removed from cart successfully',
        cart: updatedCart
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ message: 'Failed to remove item from cart' });
    }
  },

  // Apply coupon to cart
  applyCoupon: async (req: Request, res: Response) => {
    try {
      const { couponCode } = req.body;
      const userId = req.user?.userId;

      if (!couponCode) {
        return res.status(400).json({ message: 'Coupon code is required' });
      }

      const cart = await Cart.findOne({ user: userId, isActive: true });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      // Validate coupon (you can reuse the coupon validation logic here)
      // For now, we'll just store the coupon code
      // In a real implementation, you'd validate the coupon first

      res.json({
        message: 'Coupon applied successfully',
        cart: cart
      });
    } catch (error) {
      console.error('Error applying coupon:', error);
      res.status(500).json({ message: 'Failed to apply coupon' });
    }
  },

  // Clear cart
  clearCart: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;

      const cart = await Cart.findOne({ user: userId, isActive: true });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      await cart.clearCart();

      res.json({
        message: 'Cart cleared successfully',
        cart: cart
      });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Failed to clear cart' });
    }
  }
};
