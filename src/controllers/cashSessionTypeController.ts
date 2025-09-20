import { Request, Response } from 'express';
import { CashSessionType } from '../models/CashSessionType';

export const cashSessionTypeController = {
  list: async (req: Request, res: Response) => {
    try {
      const { isActive } = req.query;
      const filter: any = {};
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      const types = await CashSessionType.find(filter).sort({ createdAt: -1 });
      res.json({ types });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list session types', error: error.message });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const createdBy = (req.user as any)?.userId;
      if (!name) return res.status(400).json({ message: 'Name is required' });
      const exists = await CashSessionType.findOne({ name });
      if (exists) return res.status(409).json({ message: 'Session type already exists' });
      const type = await CashSessionType.create({ name, description, createdBy });
      res.json({ message: 'Session type created', type });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create session type', error: error.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
      const updated = await CashSessionType.findByIdAndUpdate(
        id,
        { name, description, isActive },
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: 'Session type not found' });
      res.json({ message: 'Session type updated', type: updated });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update session type', error: error.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const type = await CashSessionType.findById(id);
      if (!type) return res.status(404).json({ message: 'Session type not found' });
      // Soft delete: toggle isActive to false instead of hard delete
      if (type.isActive) {
        type.isActive = false;
        await type.save();
        return res.json({ message: 'Session type deactivated' });
      } else {
        await type.deleteOne();
        return res.json({ message: 'Session type deleted permanently' });
      }
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete session type', error: error.message });
    }
  },

};


