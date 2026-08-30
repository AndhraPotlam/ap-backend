import { Request, Response } from 'express';
import { startOfDay, endOfDay } from 'date-fns';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const expenseController = {
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { amount, paymentType, paidBy, category, date, description, notes, attachments } = req.body;
      const createdById = req.user?.userId || req.user?._id || req.user?.id;

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

      const paidById = typeof paidBy === 'object' ? paidBy?.id || paidBy?._id : paidBy;
      const categoryId = typeof category === 'object' ? category?.id || category?._id : category;

      const expense = await prisma.expense.create({
        data: {
          amount: Number(amount),
          paymentType: paymentType as any,
          paidById,
          categoryId,
          date: new Date(date),
          description: description?.trim() || null,
          notes: notes?.trim() || null,
          attachments: Array.isArray(attachments) ? attachments : [],
          createdById: createdById || null,
        },
        include: {
          paidBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({
        message: 'Expense recorded',
        expense: {
          ...expense,
          _id: expense.id,
          paidBy: formatDoc(expense.paidBy),
          category: formatDoc(expense.category),
        },
      });
    } catch (error: any) {
      console.error('Error creating expense:', error);
      res.status(500).json({ message: 'Error creating expense', error: error.message });
    }
  },

  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, paymentType, category, paidBy, startDate, endDate, search } = req.query;

      const where: any = {};
      if (paymentType) where.paymentType = paymentType;
      if (category) where.categoryId = String(category);
      if (paidBy) where.paidById = String(paidBy);

      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          const s = new Date(startDate as string);
          s.setHours(0, 0, 0, 0);
          where.date.gte = s;
        }
        if (endDate) {
          const e = new Date(endDate as string);
          e.setHours(23, 59, 59, 999);
          where.date.lte = e;
        }
      }

      if (search) {
        where.OR = [
          { description: { contains: String(search), mode: 'insensitive' } },
          { notes: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          where,
          include: {
            paidBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            category: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take,
        }),
        prisma.expense.count({ where }),
      ]);

      const formatted = expenses.map((e) => ({
        ...e,
        _id: e.id,
        paidBy: formatDoc(e.paidBy),
        category: formatDoc(e.category),
      }));

      res.json({
        expenses: formatted,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / take),
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
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: {
          paidBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true } },
        },
      });

      if (!expense) {
        res.status(404).json({ message: 'Expense not found' });
        return;
      }

      res.json({
        expense: {
          ...expense,
          _id: expense.id,
          paidBy: formatDoc(expense.paidBy),
          category: formatDoc(expense.category),
        },
      });
    } catch (error: any) {
      console.error('Error fetching expense:', error);
      res.status(500).json({ message: 'Error fetching expense', error: error.message });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { amount, paymentType, paidBy, category, date, description, notes, attachments } = req.body;

      const dataToUpdate: any = {};
      if (amount !== undefined) dataToUpdate.amount = Number(amount);
      if (paymentType !== undefined) dataToUpdate.paymentType = paymentType;
      if (paidBy !== undefined) dataToUpdate.paidById = typeof paidBy === 'object' ? paidBy?.id || paidBy?._id : paidBy;
      if (category !== undefined) dataToUpdate.categoryId = typeof category === 'object' ? category?.id || category?._id : category;
      if (date !== undefined) dataToUpdate.date = new Date(date);
      if (description !== undefined) dataToUpdate.description = description;
      if (notes !== undefined) dataToUpdate.notes = notes;
      if (attachments !== undefined) dataToUpdate.attachments = attachments;

      const expense = await prisma.expense.update({
        where: { id },
        data: dataToUpdate,
        include: {
          paidBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true } },
        },
      });

      res.json({
        message: 'Expense updated',
        expense: {
          ...expense,
          _id: expense.id,
          paidBy: formatDoc(expense.paidBy),
          category: formatDoc(expense.category),
        },
      });
    } catch (error: any) {
      console.error('Error updating expense:', error);
      res.status(500).json({ message: 'Error updating expense', error: error.message });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.expense.delete({ where: { id } });
      res.json({ message: 'Expense deleted' });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ message: 'Error deleting expense', error: error.message });
    }
  },

  summary: async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date());

      const expenses = await prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        include: {
          paidBy: { select: { id: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true } },
        },
      });

      const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const paymentTypeBreakdown: Record<string, number> = {};
      const categoryBreakdown: Record<string, number> = {};
      const userBreakdown: Record<string, number> = {};

      for (const e of expenses) {
        const pType = e.paymentType || 'unknown';
        paymentTypeBreakdown[pType] = (paymentTypeBreakdown[pType] || 0) + e.amount;

        const catName = e.category?.name || 'Unknown';
        categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + e.amount;

        const uName = e.paidBy ? `${e.paidBy.firstName} ${e.paidBy.lastName}`.trim() : 'Unknown';
        userBreakdown[uName] = (userBreakdown[uName] || 0) + e.amount;
      }

      res.json({
        summary: {
          totalAmount,
          expenseCount: expenses.length,
          paymentTypeBreakdown: Object.entries(paymentTypeBreakdown).map(([type, amount]) => ({
            type,
            amount,
            percentage: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : '0',
          })),
          categoryBreakdown: Object.entries(categoryBreakdown).map(([category, amount]) => ({
            category,
            amount,
            percentage: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : '0',
          })),
          userBreakdown: Object.entries(userBreakdown).map(([user, amount]) => ({
            user,
            amount,
            percentage: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : '0',
          })),
        },
      });
    } catch (error: any) {
      console.error('Error getting expense summary:', error);
      res.status(500).json({ message: 'Error getting expense summary', error: error.message });
    }
  },
};
