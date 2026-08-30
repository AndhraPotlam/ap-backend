import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const recipeProcessController = {
  create: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const { name, description, category, isActive = true, steps = [] } = req.body;

      const recipeProcess = await prisma.recipeProcess.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          category: category?.trim() || null,
          isActive: Boolean(isActive),
          createdById: userId || null,
          steps: {
            create: steps.map((step: any, index: number) => ({
              name: String(step.name).trim(),
              order: step.order !== undefined ? Number(step.order) : index,
              instructions: step.instructions || null,
              location: step.location || null,
              estimatedDurationMin: step.estimatedDurationMin ? Number(step.estimatedDurationMin) : null,
              tasks: {
                create: (step.tasks || []).map((t: any) => ({
                  name: String(t.name).trim(),
                  description: t.description || null,
                  type: t.type || 'other',
                  procedure: t.procedure || null,
                  priority: t.priority || 'medium',
                  itemsUsed: Array.isArray(t.itemsUsed) ? t.itemsUsed : [],
                  taskFor: Array.isArray(t.taskFor) ? t.taskFor : [],
                  tags: Array.isArray(t.tags) ? t.tags : [],
                  location: t.location || null,
                  startOffsetMin: Number(t.timeWindow?.startOffsetMin || t.startOffsetMin || 0),
                  durationMin: Number(t.timeWindow?.durationMin || t.durationMin || 5),
                })),
              },
            })),
          },
        },
        include: {
          steps: {
            include: { tasks: true },
          },
        },
      });

      res.status(201).json({ recipeProcess: formatDoc(recipeProcess) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create recipe process', error: error.message });
    }
  },

  list: async (_req: Request, res: Response) => {
    try {
      const recipeProcesses = await prisma.recipeProcess.findMany({
        include: {
          steps: {
            include: { tasks: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ recipeProcesses: formatDocs(recipeProcesses) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list recipe processes', error: error.message });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const recipeProcess = await prisma.recipeProcess.findUnique({
        where: { id: req.params.id },
        include: {
          steps: {
            include: { tasks: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!recipeProcess) return res.status(404).json({ message: 'Recipe process not found' });
      res.json({ recipeProcess: formatDoc(recipeProcess) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get recipe process', error: error.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, category, isActive, steps } = req.body;

      const recipeProcess = await prisma.$transaction(async (tx) => {
        if (steps && Array.isArray(steps)) {
          await tx.recipeStep.deleteMany({ where: { processId: id } });
          for (let index = 0; index < steps.length; index++) {
            const step = steps[index];
            await tx.recipeStep.create({
              data: {
                processId: id,
                name: String(step.name).trim(),
                order: step.order !== undefined ? Number(step.order) : index,
                instructions: step.instructions || null,
                location: step.location || null,
                estimatedDurationMin: step.estimatedDurationMin ? Number(step.estimatedDurationMin) : null,
                tasks: {
                  create: (step.tasks || []).map((t: any) => ({
                    name: String(t.name).trim(),
                    description: t.description || null,
                    type: t.type || 'other',
                    procedure: t.procedure || null,
                    priority: t.priority || 'medium',
                    itemsUsed: Array.isArray(t.itemsUsed) ? t.itemsUsed : [],
                    taskFor: Array.isArray(t.taskFor) ? t.taskFor : [],
                    tags: Array.isArray(t.tags) ? t.tags : [],
                    location: t.location || null,
                    startOffsetMin: Number(t.timeWindow?.startOffsetMin || t.startOffsetMin || 0),
                    durationMin: Number(t.timeWindow?.durationMin || t.durationMin || 5),
                  })),
                },
              },
            });
          }
        }

        return tx.recipeProcess.update({
          where: { id },
          data: {
            name: name !== undefined ? String(name).trim() : undefined,
            description: description !== undefined ? description?.trim() || null : undefined,
            category: category !== undefined ? category?.trim() || null : undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          },
          include: {
            steps: {
              include: { tasks: true },
              orderBy: { order: 'asc' },
            },
          },
        });
      });

      res.json({ recipeProcess: formatDoc(recipeProcess) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update recipe process', error: error.message });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      await prisma.recipeProcess.delete({ where: { id: req.params.id } });
      res.json({ message: 'Recipe process deleted' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete recipe process', error: error.message });
    }
  },
};
