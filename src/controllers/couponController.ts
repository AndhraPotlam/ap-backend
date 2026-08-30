import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const getAllCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(formatDocs(coupons));
  } catch (error: any) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ message: 'Failed to fetch coupons', error: error.message });
  }
};

export const getActiveCoupons = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(formatDocs(coupons));
  } catch (error: any) {
    console.error('Error fetching active coupons:', error);
    res.status(500).json({ message: 'Failed to fetch active coupons', error: error.message });
  }
};

export const getCouponById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(formatDoc(coupon));
  } catch (error: any) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({ message: 'Failed to fetch coupon', error: error.message });
  }
};

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
      applicableCategories = [],
      applicableProducts = [],
    } = req.body;

    const normalizedCode = String(code).trim().toUpperCase();
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: normalizedCode,
        name: String(name).trim(),
        description: description?.trim() || null,
        discountType: discountType === 'fixed' ? 'fixed' : 'percentage',
        discountValue: Number(discountValue),
        minimumOrderAmount: minimumOrderAmount ? Number(minimumOrderAmount) : null,
        maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: new Date(validUntil),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
        applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : [],
      },
    });

    res.status(201).json(formatDoc(coupon));
  } catch (error: any) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ message: 'Failed to create coupon', error: error.message });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.code) {
      const normalizedCode = String(updateData.code).trim().toUpperCase();
      const existingCoupon = await prisma.coupon.findFirst({
        where: { code: normalizedCode, id: { not: id } },
      });
      if (existingCoupon) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
      updateData.code = normalizedCode;
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: updateData.code,
        name: updateData.name,
        description: updateData.description,
        discountType: updateData.discountType,
        discountValue: updateData.discountValue !== undefined ? Number(updateData.discountValue) : undefined,
        minimumOrderAmount: updateData.minimumOrderAmount !== undefined ? (updateData.minimumOrderAmount ? Number(updateData.minimumOrderAmount) : null) : undefined,
        maximumDiscount: updateData.maximumDiscount !== undefined ? (updateData.maximumDiscount ? Number(updateData.maximumDiscount) : null) : undefined,
        validFrom: updateData.validFrom ? new Date(updateData.validFrom) : undefined,
        validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined,
        usageLimit: updateData.usageLimit !== undefined ? (updateData.usageLimit ? Number(updateData.usageLimit) : null) : undefined,
        isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : undefined,
        applicableCategories: updateData.applicableCategories,
        applicableProducts: updateData.applicableProducts,
      },
    });

    res.json(formatDoc(coupon));
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ message: 'Failed to update coupon', error: error.message });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.coupon.delete({ where: { id } });
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ message: 'Failed to delete coupon', error: error.message });
  }
};

export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || orderAmount === undefined) {
      return res.status(400).json({ message: 'Coupon code and order amount are required' });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: String(code).trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ message: 'Invalid or inactive coupon code' });
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: 'Coupon has expired or is not yet active' });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'Coupon usage limit has been reached' });
    }

    if (coupon.minimumOrderAmount && Number(orderAmount) < coupon.minimumOrderAmount) {
      return res.status(400).json({ message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required` });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (Number(orderAmount) * coupon.discountValue) / 100;
      if (coupon.maximumDiscount) {
        discount = Math.min(discount, coupon.maximumDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      valid: true,
      coupon: formatDoc(coupon),
      discount,
      finalAmount: Math.max(0, Number(orderAmount) - discount),
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ message: 'Failed to validate coupon', error: error.message });
  }
};

export const applyCoupon = async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params;

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });

    res.json({ message: 'Coupon applied successfully', coupon: formatDoc(coupon) });
  } catch (error: any) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ message: 'Failed to apply coupon', error: error.message });
  }
};
