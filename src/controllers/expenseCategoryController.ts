import { Request, Response } from 'express';
import { ExpenseCategory, IExpenseCategory } from '../models/ExpenseCategory';
import { Expense } from '../models/Expense';

export const expenseCategoryController = {
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, isActive } = req.body;
      if (!name) {
        res.status(400).json({ message: 'Category name is required' });
        return;
      }
      const category = await ExpenseCategory.create({
        name,
        description,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user?.userId,
      } as Partial<IExpenseCategory>);
      res.status(201).json({ message: 'Category created', category });
    } catch (error: any) {
      console.error('Error creating expense category:', error);
      res.status(500).json({ message: 'Error creating expense category', error: error.message });
    }
  },

  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, isActive } = req.query;
      const filter: any = {};
      if (typeof isActive === 'string' && (isActive === 'true' || isActive === 'false')) {
        filter.isActive = isActive === 'true';
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search as string, $options: 'i' } },
          { description: { $regex: search as string, $options: 'i' } },
        ];
      }
      const categories = await ExpenseCategory.find(filter).sort({ name: 1 });
      res.json({ categories });
    } catch (error: any) {
      console.error('Error fetching expense categories:', error);
      res.status(500).json({ message: 'Error fetching expense categories', error: error.message });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const category = await ExpenseCategory.findById(id);
      if (!category) {
        res.status(404).json({ message: 'Expense category not found' });
        return;
      }
      res.json({ category });
    } catch (error: any) {
      console.error('Error fetching expense category:', error);
      res.status(500).json({ message: 'Error fetching expense category', error: error.message });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const category = await ExpenseCategory.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
      if (!category) {
        res.status(404).json({ message: 'Expense category not found' });
        return;
      }
      res.json({ message: 'Category updated', category });
    } catch (error: any) {
      console.error('Error updating expense category:', error);
      res.status(500).json({ message: 'Error updating expense category', error: error.message });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      // Prevent deletion if any expense uses this category
      const linkedCount = await Expense.countDocuments({ category: id });
      if (linkedCount > 0) {
        res.status(400).json({ message: 'Cannot delete: expenses exist for this category. Mark it inactive instead.' });
        return;
      }
      const category = await ExpenseCategory.findByIdAndDelete(id);
      if (!category) {
        res.status(404).json({ message: 'Expense category not found' });
        return;
      }
      res.json({ message: 'Category deleted' });
    } catch (error: any) {
      console.error('Error deleting expense category:', error);
      res.status(500).json({ message: 'Error deleting expense category', error: error.message });
    }
  },
};


