import { Request, Response } from 'express';
import Coupon from '../models/Coupon';

// Get all coupons
export const getAllCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ message: 'Failed to fetch coupons' });
  }
};

// Get active coupons
export const getActiveCoupons = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    }).sort({ createdAt: -1 });
    
    res.json(coupons);
  } catch (error) {
    console.error('Error fetching active coupons:', error);
    res.status(500).json({ message: 'Failed to fetch active coupons' });
  }
};

// Get coupon by ID
export const getCouponById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    res.json(coupon);
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({ message: 'Failed to fetch coupon' });
  }
};

// Create new coupon
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      validFrom,
      validUntil,
      usageLimit,
      applicableCategories,
      applicableProducts
    } = req.body;
    
    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }
    
    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      validFrom: validFrom || new Date(),
      validUntil,
      usageLimit,
      applicableCategories,
      applicableProducts
    });
    
    await coupon.save();
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ message: 'Failed to create coupon' });
  }
};

// Update coupon
export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // If code is being updated, check for duplicates
    if (updateData.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingCoupon) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
      updateData.code = updateData.code.toUpperCase();
    }
    
    const coupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    res.json(coupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ message: 'Failed to update coupon' });
  }
};

// Delete coupon
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ message: 'Failed to delete coupon' });
  }
};

// Validate coupon code
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, orderAmount, categoryIds, productIds } = req.body;
    
    if (!code || !orderAmount) {
      return res.status(400).json({ message: 'Coupon code and order amount are required' });
    }
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }
    
    // Use the model's validation method
    const validation = coupon.canBeUsed(orderAmount);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    // Check applicable categories
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
      if (!categoryIds || !categoryIds.some((id: string) => 
        coupon.applicableCategories!.some(catId => catId.toString() === id)
      )) {
        return res.status(400).json({ message: 'Coupon not applicable to selected items' });
      }
    }

    // Check applicable products
    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      if (!productIds || !productIds.some((id: string) => 
        coupon.applicableProducts!.some(prodId => prodId.toString() === id)
      )) {
        return res.status(400).json({ message: 'Coupon not applicable to selected items' });
      }
    }
    
    // Use the model's calculation method
    const discount = coupon.calculateDiscount(orderAmount);
    
    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumOrderAmount: coupon.minimumOrderAmount,
        maximumDiscount: coupon.maximumDiscount
      },
      discount,
      finalAmount: orderAmount - discount
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ message: 'Failed to validate coupon' });
  }
};

// Apply coupon to order (increment usage count)
export const applyCoupon = async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params;
    
    const coupon = await Coupon.findById(couponId);
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    // Increment usage count and handle limit reached
    await coupon.incrementUsage();
    
    res.json({ message: 'Coupon applied successfully', coupon });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ message: 'Failed to apply coupon' });
  }
};
