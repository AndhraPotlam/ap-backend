import { Request, Response } from 'express';
import Discount from '../models/Discount';

export const discountController = {
  // Get all discounts
  getAllDiscounts: async (req: Request, res: Response) => {
    try {
      const discounts = await Discount.find().sort({ createdAt: -1 });
      res.json(discounts);
    } catch (error) {
      console.error('Error fetching discounts:', error);
      res.status(500).json({ message: 'Failed to fetch discounts' });
    }
  },

  // Get active discounts
  getActiveDiscounts: async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const discounts = await Discount.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      }).sort({ createdAt: -1 });
      
      res.json(discounts);
    } catch (error) {
      console.error('Error fetching active discounts:', error);
      res.status(500).json({ message: 'Failed to fetch active discounts' });
    }
  },

  // Get discount by ID
  getDiscountById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const discount = await Discount.findById(id);
      
      if (!discount) {
        return res.status(404).json({ message: 'Discount not found' });
      }
      
      res.json(discount);
    } catch (error) {
      console.error('Error fetching discount:', error);
      res.status(500).json({ message: 'Failed to fetch discount' });
    }
  },

  // Create new discount
  createDiscount: async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        type,
        value,
        minimumOrderAmount,
        maximumDiscount,
        validFrom,
        validUntil,
        usageLimit,
        applicableCategories,
        applicableProducts,
        conditions
      } = req.body;
      
      const discount = new Discount({
        name,
        description,
        type,
        value,
        minimumOrderAmount,
        maximumDiscount,
        validFrom: validFrom || new Date(),
        validUntil,
        usageLimit,
        applicableCategories,
        applicableProducts,
        conditions: conditions || {}
      });
      
      await discount.save();
      res.status(201).json(discount);
    } catch (error) {
      console.error('Error creating discount:', error);
      res.status(500).json({ message: 'Failed to create discount' });
    }
  },

  // Update discount
  updateDiscount: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const discount = await Discount.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!discount) {
        return res.status(404).json({ message: 'Discount not found' });
      }
      
      res.json(discount);
    } catch (error) {
      console.error('Error updating discount:', error);
      res.status(500).json({ message: 'Failed to update discount' });
    }
  },

  // Delete discount
  deleteDiscount: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const discount = await Discount.findByIdAndDelete(id);
      
      if (!discount) {
        return res.status(404).json({ message: 'Discount not found' });
      }
      
      res.json({ message: 'Discount deleted successfully' });
    } catch (error) {
      console.error('Error deleting discount:', error);
      res.status(500).json({ message: 'Failed to delete discount' });
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
      const activeDiscounts = await Discount.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      });
      
      const applicableDiscounts = [];
      const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      
      for (const discount of activeDiscounts) {
        // Use the model's validation method
        const validation = discount.canBeApplied(orderAmount, totalQuantity);
        if (!validation.valid) {
          continue;
        }
        
        // Check applicable categories and products
        let isApplicable = true;
        
        if (discount.applicableCategories && discount.applicableCategories.length > 0) {
          const itemCategories = items.map((item: any) => item.categoryId).filter(Boolean);
          if (!itemCategories.some((catId: string) => 
            discount.applicableCategories!.some(cat => cat.toString() === catId)
          )) {
            isApplicable = false;
          }
        }
        
        if (discount.applicableProducts && discount.applicableProducts.length > 0) {
          const itemProductIds = items.map((item: any) => item.productId).filter(Boolean);
          if (!itemProductIds.some((prodId: string) => 
            discount.applicableProducts!.some(prod => prod.toString() === prodId)
          )) {
            isApplicable = false;
          }
        }
        
        if (isApplicable) {
          // Use the model's calculation method
          const discountAmount = discount.calculateDiscount(orderAmount, totalQuantity);
          
          if (discountAmount > 0) {
            applicableDiscounts.push({
              discount: {
                _id: discount._id,
                name: discount.name,
                description: discount.description,
                type: discount.type,
                value: discount.value
              },
              discountAmount,
              finalAmount: orderAmount - discountAmount
            });
          }
        }
      }
      
      res.json({
        applicableDiscounts,
        totalDiscount: applicableDiscounts.reduce((sum, d) => sum + d.discountAmount, 0),
        finalAmount: orderAmount - applicableDiscounts.reduce((sum, d) => sum + d.discountAmount, 0)
      });
    } catch (error) {
      console.error('Error calculating applicable discounts:', error);
      res.status(500).json({ message: 'Failed to calculate applicable discounts' });
    }
  }
};
