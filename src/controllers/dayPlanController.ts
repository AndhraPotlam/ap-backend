import { Request, Response } from 'express';
import { DayPlan } from '../models/DayPlan';
import { Recipe } from '../models/Recipe';
import { Task } from '../models/Task';

function parseTimeToMinutes(time?: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const dayPlanController = {
  create: async (req: Request, res: Response) => {
    try {
      const plan = await DayPlan.create({ ...req.body, generatedBy: req.user?.userId });
      res.status(201).json({ plan });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create day plan', error: error.message });
    }
  },
  list: async (req: Request, res: Response) => {
    try {
      const { date } = req.query as { date?: string };
      const filter: any = {};
      if (date) filter.date = new Date(date);
      const plans = await DayPlan.find(filter).populate('selectedRecipes.recipe', 'name');
      res.json({ plans });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list day plans', error: error.message });
    }
  },
  generateTasks: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plan = await DayPlan.findById(id).populate('selectedRecipes.recipe');
      if (!plan) return res.status(404).json({ message: 'Day plan not found' });

      const dateOnly = new Date(plan.date);
      dateOnly.setHours(0,0,0,0);

      const generated: any[] = [];
      const skipped: any[] = [];

      for (const sel of plan.selectedRecipes) {
        const recipeDoc: any = sel.recipe;
        if (!recipeDoc?.steps) continue;
        const baseMinutes = parseTimeToMinutes(sel.plannedStart);

        for (const step of recipeDoc.steps.sort((a: any, b: any) => (a.order||0)-(b.order||0))) {
          for (const tmpl of (step.tasks || [])) {
            const startMin = baseMinutes + (tmpl.timeWindow?.startOffsetMin || 0);
            const endMin = startMin + (tmpl.timeWindow?.durationMin || 0);

            const plannedStart = new Date(dateOnly);
            plannedStart.setMinutes(startMin);
            const plannedEnd = new Date(dateOnly);
            plannedEnd.setMinutes(endMin);

            const exists = await Task.findOne({
              title: tmpl.name,
              'tags': { $in: [`recipe:${recipeDoc._id}`, `step:${step._id}`] },
              dueDate: { $gte: dateOnly, $lte: new Date(dateOnly.getTime() + 24*60*60*1000 - 1) }
            });

            if (exists) {
              skipped.push({ recipe: recipeDoc.name, step: step.name, template: tmpl.name, reason: 'exists' });
              continue;
            }

            const task = await Task.create({
              title: tmpl.name,
              description: tmpl.description,
              taskFor: tmpl.taskFor && tmpl.taskFor.length ? tmpl.taskFor[0] : 'hotel',
              taskOwner: (tmpl.defaultAssignees && tmpl.defaultAssignees[0]) || req.user?.userId,
              assignedBy: req.user?.userId,
              priority: tmpl.priority || 'medium',
              procedure: tmpl.procedure,
              checklistType: 'custom',
              dueDate: plannedStart,
              notes: `${recipeDoc.name} • ${step.name}`,
              location: tmpl.location,
              estimatedDuration: tmpl.timeWindow?.durationMin,
              tags: [`recipe:${recipeDoc._id}`, `step:${step._id}`, ...(tmpl.tags || [])]
            });

            generated.push(task);
          }
        }
      }

      plan.generatedAt = new Date();
      await plan.save();

      res.json({ message: 'Tasks generated', totalGenerated: generated.length, totalSkipped: skipped.length, generated, skipped });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to generate tasks', error: error.message });
    }
  }
};


