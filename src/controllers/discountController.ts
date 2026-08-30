import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const discountController = {
  // Get all discounts
  getAllDiscounts: async (req: Request, res: Response) => {
    try {
      const discounts = await prisma.discount.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json(formatDocs(discounts));
    } catch (error: any) {
      console.error('Error fetching discounts:', error);
      res.status(500).json({ message: 'Failed to fetch discounts', error: error.message });
    }
  },

  // Get active discounts
  getActiveDiscounts: async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const discounts = await prisma.discount.findMany({
        where: {
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(formatDocs(discounts));
    } catch (error: any) {
      console.error('Error fetching active discounts:', error);
      res.status(500).json({ message: 'Failed to fetch active discounts', error: error.message });
    }
  },

  // Get discount by ID
  getDiscountById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const discount = await prisma.discount.findUnique({
        where: { id },
      });

      if (!discount) {
        return res.status(404).json({ message: 'Discount not found' });
      }

      res.json(formatDoc(discount));
    } catch (error: any) {
      console.error('Error fetching discount:', error);
      res.status(500).json({ message: 'Failed to fetch discount', error: error.message });
    }
  },

  // Create new discount
  createDiscount: async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        type = 'percentage',
        value,
        minimumOrderAmount,
        maximumDiscount,
        validFrom,
        validUntil,
        usageLimit,
        applicableCategories = [],
        applicableProducts = [],
        conditions,
      } = req.body;

      const discount = await prisma.discount.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          type: type as any,
          value: Number(value),
          minimumOrderAmount: minimumOrderAmount ? Number(minimumOrderAmount) : null,
          maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validUntil: new Date(validUntil),
          usageLimit: usageLimit ? Number(usageLimit) : null,
          applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
          applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : [],
          conditions: conditions || {},
        },
      });

      res.status(201).json(formatDoc(discount));
    } catch (error: any) {
      console.error('Error creating discount:', error);
      res.status(500).json({ message: 'Failed to create discount', error: error.message });
    }
  },

  // Update discount
  updateDiscount: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const discount = await prisma.discount.update({
        where: { id },
        data: {
          name: updateData.name,
          description: updateData.description,
          type: updateData.type,
          value: updateData.value !== undefined ? Number(updateData.value) : undefined,
          minimumOrderAmount: updateData.minimumOrderAmount !== undefined ? (updateData.minimumOrderAmount ? Number(updateData.minimumOrderAmount) : null) : undefined,
          maximumDiscount: updateData.maximumDiscount !== undefined ? (updateData.maximumDiscount ? Number(updateData.maximumDiscount) : null) : undefined,
          validFrom: updateData.validFrom ? new Date(updateData.validFrom) : undefined,
          validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined,
          usageLimit: updateData.usageLimit !== undefined ? (updateData.usageLimit ? Number(updateData.usageLimit) : null) : undefined,
          isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : undefined,
          applicableCategories: updateData.applicableCategories,
          applicableProducts: updateData.applicableProducts,
          conditions: updateData.conditions,
        },
      });

      res.json(formatDoc(discount));
    } catch (error: any) {
      console.error('Error updating discount:', error);
      res.status(500).json({ message: 'Failed to update discount', error: error.message });
    }
  },

  // Delete discount
  deleteDiscount: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.discount.delete({ where: { id } });
      res.json({ message: 'Discount deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      res.status(500).json({ message: 'Failed to delete discount', error: error.message });
    }
  },

  // Calculate applicable discounts for an order
  calculateApplicableDiscounts: async (req: Request, res: Response) => {
    try {
      const { items, orderAmount } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Items array is required' });
      }

      const now = new Date();
      const activeDiscounts = await prisma.discount.findMany({
        where: {
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
      });

      const applicableDiscounts = [];
      const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      const amount = Number(orderAmount) || 0;

      for (const discount of activeDiscounts) {
        if (discount.minimumOrderAmount && amount < discount.minimumOrderAmount) {
          continue;
        }

        let discountAmount = 0;
        if (discount.type === 'percentage') {
          discountAmount = (amount * discount.value) / 100;
          if (discount.maximumDiscount) {
            discountAmount = Math.min(discountAmount, discount.maximumDiscount);
          }
        } else if (discount.type === 'fixed') {
          discountAmount = discount.value;
        }

        if (discountAmount > 0) {
          applicableDiscounts.push({
            discount: formatDoc(discount),
            discountAmount,
            finalAmount: Math.max(0, amount - discountAmount),
          });
        }
      }

      const totalDiscount = applicableDiscounts.reduce((sum, d) => sum + d.discountAmount, 0);

      res.json({
        applicableDiscounts,
        totalDiscount,
        finalAmount: Math.max(0, amount - totalDiscount),
      });
    } catch (error: any) {
      console.error('Error calculating applicable discounts:', error);
      res.status(500).json({ message: 'Failed to calculate applicable discounts', error: error.message });
    }
  },
};
