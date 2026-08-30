import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const expenseCategoryController = {
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, isActive } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!name) {
        res.status(400).json({ message: 'Category name is required' });
        return;
      }

      const category = await prisma.expenseCategory.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          createdById: userId || null,
        },
      });

      res.status(201).json({ message: 'Category created', category: formatDoc(category) });
    } catch (error: any) {
      console.error('Error creating expense category:', error);
      res.status(500).json({ message: 'Error creating expense category', error: error.message });
    }
  },

  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, isActive } = req.query;
      const where: any = {};

      if (typeof isActive === 'string' && (isActive === 'true' || isActive === 'false')) {
        where.isActive = isActive === 'true';
      }

      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const categories = await prisma.expenseCategory.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      res.json({ categories: formatDocs(categories) });
    } catch (error: any) {
      console.error('Error fetching expense categories:', error);
      res.status(500).json({ message: 'Error fetching expense categories', error: error.message });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const category = await prisma.expenseCategory.findUnique({
        where: { id },
      });

      if (!category) {
        res.status(404).json({ message: 'Expense category not found' });
        return;
      }

      res.json({ category: formatDoc(category) });
    } catch (error: any) {
      console.error('Error fetching expense category:', error);
      res.status(500).json({ message: 'Error fetching expense category', error: error.message });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const category = await prisma.expenseCategory.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          description: description !== undefined ? String(description).trim() : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
      });

      res.json({ message: 'Category updated', category: formatDoc(category) });
    } catch (error: any) {
      console.error('Error updating expense category:', error);
      res.status(500).json({ message: 'Error updating expense category', error: error.message });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const linkedCount = await prisma.expense.count({
        where: { categoryId: id },
      });

      if (linkedCount > 0) {
        res.status(400).json({ message: 'Cannot delete: expenses exist for this category. Mark it inactive instead.' });
        return;
      }

      await prisma.expenseCategory.delete({ where: { id } });
      res.json({ message: 'Category deleted' });
    } catch (error: any) {
      console.error('Error deleting expense category:', error);
      res.status(500).json({ message: 'Error deleting expense category', error: error.message });
    }
  },
};
