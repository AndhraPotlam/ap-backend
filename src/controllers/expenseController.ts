import { Request, Response } from 'express';
import { Expense, IExpense } from '../models/Expense';

export const expenseController = {
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, paymentType, paidBy, category, date, description, notes, attachments } = req.body;

      if (amount === undefined || amount === null || isNaN(Number(amount))) {
        res.status(400).json({ message: 'Valid amount is required' });
        return;
      }
      if (!paymentType || !['cash', 'online'].includes(paymentType)) {
        res.status(400).json({ message: 'paymentType must be cash or online' });
        return;
      }
      if (!paidBy) {
        res.status(400).json({ message: 'paidBy (user) is required' });
        return;
      }
      if (!category) {
        res.status(400).json({ message: 'category is required' });
        return;
      }
      if (!date) {
        res.status(400).json({ message: 'date is required' });
        return;
      }

      const expense = await Expense.create({
        amount: Number(amount),
        paymentType,
        paidBy,
        category,
        date,
        description,
        notes,
        attachments,
        createdBy: req.user?.userId,
      } as Partial<IExpense>);

      const populated = await Expense.findById(expense._id)
        .populate('paidBy', 'firstName lastName email')
        .populate('category', 'name');

      res.status(201).json({ message: 'Expense recorded', expense: populated });
    } catch (error: any) {
      console.error('Error creating expense:', error);
      res.status(500).json({ message: 'Error creating expense', error: error.message });
    }
  },

  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, paymentType, category, paidBy, startDate, endDate, search } = req.query;

      const filter: any = {};
      if (paymentType) filter.paymentType = paymentType;
      if (category) filter.category = category;
      if (paidBy) filter.paidBy = paidBy;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
          const s = new Date(startDate as string);
          // Normalize to start of day
          s.setHours(0, 0, 0, 0);
          filter.date.$gte = s;
        }
        if (endDate) {
          const e = new Date(endDate as string);
          // Normalize to end of day
          e.setHours(23, 59, 59, 999);
          filter.date.$lte = e;
        }
      }
      if (search) {
        filter.$or = [
          { description: { $regex: search as string, $options: 'i' } },
          { notes: { $regex: search as string, $options: 'i' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const expenses = await Expense.find(filter)
        .populate('paidBy', 'firstName lastName email')
        .populate('category', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Expense.countDocuments(filter);

      res.json({
        expenses,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total,
        },
      });
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ message: 'Error fetching expenses', error: error.message });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const expense = await Expense.findById(id)
        .populate('paidBy', 'firstName lastName email')
        .populate('category', 'name');
      if (!expense) {
        res.status(404).json({ message: 'Expense not found' });
        return;
      }
      res.json({ expense });
    } catch (error: any) {
      console.error('Error fetching expense:', error);
      res.status(500).json({ message: 'Error fetching expense', error: error.message });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const expense = await Expense.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
        .populate('paidBy', 'firstName lastName email')
        .populate('category', 'name');
      if (!expense) {
        res.status(404).json({ message: 'Expense not found' });
        return;
      }
      res.json({ message: 'Expense updated', expense });
    } catch (error: any) {
      console.error('Error updating expense:', error);
      res.status(500).json({ message: 'Error updating expense', error: error.message });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const expense = await Expense.findByIdAndDelete(id);
      if (!expense) {
        res.status(404).json({ message: 'Expense not found' });
        return;
      }
      res.json({ message: 'Expense deleted' });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ message: 'Error deleting expense', error: error.message });
    }
  },
};


