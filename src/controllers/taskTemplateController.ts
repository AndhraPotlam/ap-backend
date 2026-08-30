import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const taskTemplateController = {
  createTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        description,
        taskFor = 'hotel',
        procedure,
        checklistType = 'custom',
        estimatedDuration,
        priority = 'medium',
        tags = [],
        location,
        category = 'general',
        instructions = [],
        requiredSkills = [],
        equipment = [],
        safetyNotes,
      } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      if (!name || !description || !procedure || estimatedDuration === undefined) {
        res.status(400).json({
          message: 'Name, description, procedure, and estimated duration are required',
        });
        return;
      }

      const template = await prisma.taskTemplate.create({
        data: {
          name: String(name).trim(),
          description: String(description).trim(),
          taskFor,
          procedure: String(procedure).trim(),
          checklistType: checklistType as any,
          estimatedDuration: Number(estimatedDuration),
          priority: priority as any,
          tags: Array.isArray(tags) ? tags : [],
          location: location || null,
          category: String(category).trim(),
          instructions: Array.isArray(instructions) ? instructions : [],
          requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
          equipment: Array.isArray(equipment) ? equipment : [],
          safetyNotes: safetyNotes || null,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.status(201).json({
        message: 'Task template created successfully',
        template: {
          ...template,
          _id: template.id,
          createdBy: formatDoc(template.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error creating task template:', error);
      res.status(500).json({ message: 'Error creating task template', error: error.message });
    }
  },

  getAllTemplates: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, taskFor, checklistType, category, isActive, search } = req.query;

      const where: any = {};
      if (taskFor) where.taskFor = String(taskFor);
      if (checklistType) where.checklistType = checklistType as any;
      if (category) where.category = String(category);
      if (isActive !== undefined) where.isActive = isActive === 'true';

      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
          { category: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [templates, total] = await Promise.all([
        prisma.taskTemplate.findMany({
          where,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.taskTemplate.count({ where }),
      ]);

      const formatted = templates.map((t) => ({
        ...t,
        _id: t.id,
        createdBy: formatDoc(t.createdBy),
      }));

      res.json({
        templates: formatted,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / take),
          total,
        },
      });
    } catch (error: any) {
      console.error('Error fetching task templates:', error);
      res.status(500).json({ message: 'Error fetching task templates', error: error.message });
    }
  },

  getTemplatesByChecklistType: async (req: Request, res: Response): Promise<void> => {
    try {
      const { checklistType } = req.params;

      const templates = await prisma.taskTemplate.findMany({
        where: {
          checklistType: checklistType as any,
          isActive: true,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      const formatted = templates.map((t) => ({
        ...t,
        _id: t.id,
        createdBy: formatDoc(t.createdBy),
      }));

      res.json(formatted);
    } catch (error: any) {
      console.error('Error fetching templates by checklist type:', error);
      res.status(500).json({ message: 'Error fetching templates by checklist type', error: error.message });
    }
  },

  getTemplateById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await prisma.taskTemplate.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      if (!template) {
        res.status(404).json({ message: 'Task template not found' });
        return;
      }

      res.json({
        template: {
          ...template,
          _id: template.id,
          createdBy: formatDoc(template.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error fetching task template:', error);
      res.status(500).json({ message: 'Error fetching task template', error: error.message });
    }
  },

  updateTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      const existingTemplate = await prisma.taskTemplate.findUnique({ where: { id } });
      if (!existingTemplate) {
        res.status(404).json({ message: 'Task template not found' });
        return;
      }

      if (existingTemplate.createdById !== userId && !isAdmin) {
        res.status(403).json({ message: 'You can only update templates created by you' });
        return;
      }

      const template = await prisma.taskTemplate.update({
        where: { id },
        data: {
          name: updateData.name,
          description: updateData.description,
          taskFor: updateData.taskFor,
          procedure: updateData.procedure,
          checklistType: updateData.checklistType,
          estimatedDuration: updateData.estimatedDuration !== undefined ? Number(updateData.estimatedDuration) : undefined,
          priority: updateData.priority,
          tags: updateData.tags,
          location: updateData.location,
          isActive: updateData.isActive !== undefined ? Boolean(updateData.isActive) : undefined,
          category: updateData.category,
          instructions: updateData.instructions,
          requiredSkills: updateData.requiredSkills,
          equipment: updateData.equipment,
          safetyNotes: updateData.safetyNotes,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json({
        message: 'Task template updated successfully',
        template: {
          ...template,
          _id: template.id,
          createdBy: formatDoc(template.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error updating task template:', error);
      res.status(500).json({ message: 'Error updating task template', error: error.message });
    }
  },

  deleteTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      const template = await prisma.taskTemplate.findUnique({ where: { id } });
      if (!template) {
        res.status(404).json({ message: 'Task template not found' });
        return;
      }

      if (template.createdById !== userId && !isAdmin) {
        res.status(403).json({ message: 'You can only delete templates created by you' });
        return;
      }

      await prisma.taskTemplate.delete({ where: { id } });
      res.json({ message: 'Task template deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting task template:', error);
      res.status(500).json({ message: 'Error deleting task template', error: error.message });
    }
  },

  getTemplateCategories: async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await prisma.taskTemplate.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { category: true },
        orderBy: { category: 'asc' },
      });

      const formatted = categories.map((c) => ({
        _id: c.category,
        count: c._count.category,
      }));

      res.json(formatted);
    } catch (error: any) {
      console.error('Error fetching template categories:', error);
      res.status(500).json({ message: 'Error fetching template categories', error: error.message });
    }
  },

  duplicateTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const userId = req.user?.userId || req.user?._id || req.user?.id;

      const original = await prisma.taskTemplate.findUnique({ where: { id } });
      if (!original) {
        res.status(404).json({ message: 'Task template not found' });
        return;
      }

      const newTemplate = await prisma.taskTemplate.create({
        data: {
          name: name || `${original.name} (Copy)`,
          description: original.description,
          taskFor: original.taskFor,
          procedure: original.procedure,
          checklistType: original.checklistType,
          estimatedDuration: original.estimatedDuration,
          priority: original.priority,
          tags: original.tags,
          location: original.location,
          category: original.category,
          instructions: original.instructions,
          requiredSkills: original.requiredSkills,
          equipment: original.equipment,
          safetyNotes: original.safetyNotes,
          createdById: userId,
        },
      });

      res.status(201).json({
        message: 'Task template duplicated successfully',
        template: formatDoc(newTemplate),
      });
    } catch (error: any) {
      console.error('Error duplicating task template:', error);
      res.status(500).json({ message: 'Error duplicating task template', error: error.message });
    }
  },
};
