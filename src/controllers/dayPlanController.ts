import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

function parseTimeToMinutes(time?: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const dayPlanController = {
  create: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const { date, shift, selectedRecipes = [] } = req.body;

      const plan = await prisma.dayPlan.create({
        data: {
          date: new Date(date),
          shift: shift || null,
          generatedById: userId || null,
          selectedRecipes: {
            create: selectedRecipes.map((sr: any) => ({
              recipeId: typeof sr.recipe === 'object' ? sr.recipe?.id || sr.recipe?._id : sr.recipe,
              plannedStart: sr.plannedStart || null,
            })),
          },
        },
        include: {
          selectedRecipes: {
            include: { recipe: true },
          },
        },
      });

      res.status(201).json({ plan: formatDoc(plan) });
    } catch (error: any) {
      console.error('Error creating day plan:', error);
      res.status(500).json({ message: 'Failed to create day plan', error: error.message });
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      const { date } = req.query as { date?: string };
      const where: any = {};
      if (date) where.date = new Date(date);

      const plans = await prisma.dayPlan.findMany({
        where,
        include: {
          selectedRecipes: {
            include: { recipe: { select: { id: true, name: true } } },
          },
        },
        orderBy: { date: 'desc' },
      });

      const formatted = plans.map((p) => ({
        ...p,
        _id: p.id,
        selectedRecipes: p.selectedRecipes.map((sr) => ({
          ...sr,
          _id: sr.id,
          recipe: formatDoc(sr.recipe),
        })),
      }));

      res.json({ plans: formatted });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list day plans', error: error.message });
    }
  },

  generateTasks: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      const plan = await prisma.dayPlan.findUnique({
        where: { id },
        include: {
          selectedRecipes: {
            include: {
              recipe: {
                include: {
                  steps: {
                    include: { tasks: true },
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!plan) return res.status(404).json({ message: 'Day plan not found' });

      const dateOnly = new Date(plan.date);
      dateOnly.setHours(0, 0, 0, 0);

      const generated: any[] = [];
      const skipped: any[] = [];

      for (const sel of plan.selectedRecipes) {
        const recipeDoc = sel.recipe;
        if (!recipeDoc?.steps) continue;

        const baseMinutes = parseTimeToMinutes(sel.plannedStart || undefined);

        for (const step of recipeDoc.steps) {
          for (const tmpl of step.tasks) {
            const startMin = baseMinutes + tmpl.startOffsetMin;
            const endMin = startMin + tmpl.durationMin;

            const plannedStart = new Date(dateOnly);
            plannedStart.setMinutes(startMin);
            const plannedEnd = new Date(dateOnly);
            plannedEnd.setMinutes(endMin);

            const endOfDayDate = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000 - 1);
            const existingTask = await prisma.task.findFirst({
              where: {
                title: tmpl.name,
                tags: { has: `recipe:${recipeDoc.id}` },
                dueDate: { gte: dateOnly, lte: endOfDayDate },
              },
            });

            if (existingTask) {
              skipped.push({ recipe: recipeDoc.name, step: step.name, template: tmpl.name, reason: 'exists' });
              continue;
            }

            try {
              const task = await prisma.task.create({
                data: {
                  title: tmpl.name || 'Unnamed Task',
                  description: tmpl.description || tmpl.name || 'Task from recipe',
                  taskFor: tmpl.taskFor?.[0] || 'hotel',
                  taskOwnerId: userId,
                  assignedById: userId,
                  priority: (tmpl.priority as any) || 'medium',
                  procedure: tmpl.procedure || null,
                  checklistType: 'custom',
                  dueDate: plannedStart,
                  startTime: plannedStart,
                  endTime: plannedEnd,
                  notes: `${recipeDoc.name} Recipe Process • ${step.name}`,
                  location: tmpl.location || step.location || null,
                  estimatedDuration: tmpl.durationMin || (endMin - startMin) || 15,
                  tags: [`recipe:${recipeDoc.id}`, `step:${step.id}`, ...(tmpl.tags || [])],
                },
              });
              generated.push(formatDoc(task));
            } catch (createErr: any) {
              skipped.push({ recipe: recipeDoc.name, step: step.name, template: tmpl.name, reason: createErr?.message });
            }
          }
        }
      }

      await prisma.dayPlan.update({
        where: { id },
        data: { generatedAt: new Date() },
      });

      res.json({
        message: 'Tasks generated',
        totalGenerated: generated.length,
        totalSkipped: skipped.length,
        generated,
        skipped,
      });
    } catch (error: any) {
      console.error('Error in generateTasks:', error);
      res.status(500).json({ message: 'Failed to generate tasks', error: error.message });
    }
  },
};
