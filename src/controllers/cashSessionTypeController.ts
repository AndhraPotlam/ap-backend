import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const cashSessionTypeController = {
  list: async (req: Request, res: Response) => {
    try {
      const { isActive } = req.query;
      const where: any = {};
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const types = await prisma.cashSessionType.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      res.json({ types: formatDocs(types) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list session types', error: error.message });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const createdBy = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.id;
      if (!name) return res.status(400).json({ message: 'Name is required' });

      const exists = await prisma.cashSessionType.findUnique({
        where: { name: String(name).trim() },
      });
      if (exists) return res.status(409).json({ message: 'Session type already exists' });

      const type = await prisma.cashSessionType.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          createdBy: createdBy || 'system',
        },
      });

      res.json({ message: 'Session type created', type: formatDoc(type) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create session type', error: error.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const updated = await prisma.cashSessionType.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          description: description !== undefined ? String(description).trim() : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
      });

      res.json({ message: 'Session type updated', type: formatDoc(updated) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update session type', error: error.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const type = await prisma.cashSessionType.findUnique({ where: { id } });
      if (!type) return res.status(404).json({ message: 'Session type not found' });

      if (type.isActive) {
        await prisma.cashSessionType.update({
          where: { id },
          data: { isActive: false },
        });
        return res.json({ message: 'Session type deactivated' });
      } else {
        await prisma.cashSessionType.delete({ where: { id } });
        return res.json({ message: 'Session type deleted permanently' });
      }
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete session type', error: error.message });
    }
  },
};
