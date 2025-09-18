import { Request, Response } from 'express';
import { TaskTemplate, ITaskTemplate } from '../models/TaskTemplate';

export const taskTemplateController = {
  // Create a new task template
  createTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        description,
        taskFor,
        procedure,
        checklistType,
        estimatedDuration,
        priority,
        tags,
        location,
        category,
        instructions,
        requiredSkills,
        equipment,
        safetyNotes
      } = req.body;

      // Validate required fields
      if (!name || !description || !procedure || !estimatedDuration) {
        res.status(400).json({
          message: 'Name, description, procedure, and estimated duration are required'
        });
        return;
      }

      const templateData: Partial<ITaskTemplate> = {
        name,
        description,
        taskFor: taskFor || 'hotel',
        procedure,
        checklistType: checklistType || 'custom',
        estimatedDuration,
        priority: priority || 'medium',
        tags,
        location,
        category,
        instructions,
        requiredSkills,
        equipment,
        safetyNotes,
        createdBy: req.user?.userId
      };

      const template = await TaskTemplate.create(templateData);

      res.status(201).json({
        message: 'Task template created successfully',
        template
      });
    } catch (error: any) {
      console.error('Error creating task template:', error);
      res.status(500).json({
        message: 'Error creating task template',
        error: error.message
      });
    }
  },

  // Get all task templates
  getAllTemplates: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        taskFor,
        checklistType,
        category,
        isActive,
        search
      } = req.query;

      const filter: any = {};

      // Apply filters
      if (taskFor) filter.taskFor = taskFor;
      if (checklistType) filter.checklistType = checklistType;
      if (category) filter.category = category;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      // Search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const templates = await TaskTemplate.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await TaskTemplate.countDocuments(filter);

      res.json({
        templates,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total
        }
      });
    } catch (error: any) {
      console.error('Error fetching task templates:', error);
      res.status(500).json({
        message: 'Error fetching task templates',
        error: error.message
      });
    }
  },

  // Get templates by checklist type
  getTemplatesByChecklistType: async (req: Request, res: Response): Promise<void> => {
    try {
      const { checklistType } = req.params;

      if (!['daily', 'weekly', 'monthly', 'custom'].includes(checklistType)) {
        res.status(400).json({
          message: 'Invalid checklist type'
        });
        return;
      }

      const templates = await TaskTemplate.find({
        checklistType,
        isActive: true
      })
        .populate('createdBy', 'firstName lastName email')
        .sort({ category: 1, name: 1 });

      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching templates by checklist type:', error);
      res.status(500).json({
        message: 'Error fetching templates by checklist type',
        error: error.message
      });
    }
  },

  // Get a single template by ID
  getTemplateById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const template = await TaskTemplate.findById(id)
        .populate('createdBy', 'firstName lastName email');

      if (!template) {
        res.status(404).json({
          message: 'Task template not found'
        });
        return;
      }

      res.json({
        template
      });
    } catch (error: any) {
      console.error('Error fetching task template:', error);
      res.status(500).json({
        message: 'Error fetching task template',
        error: error.message
      });
    }
  },

  // Update a task template
  updateTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if template exists
      const existingTemplate = await TaskTemplate.findById(id);
      if (!existingTemplate) {
        res.status(404).json({
          message: 'Task template not found'
        });
        return;
      }

      // Check permissions (creator or admin)
      const isCreator = existingTemplate.createdBy.toString() === req.user?.userId;
      const isAdmin = req.user?.role === 'admin';

      if (!isCreator && !isAdmin) {
        res.status(403).json({
          message: 'You can only update templates created by you'
        });
        return;
      }

      const template = await TaskTemplate.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('createdBy', 'firstName lastName email');

      res.json({
        message: 'Task template updated successfully',
        template
      });
    } catch (error: any) {
      console.error('Error updating task template:', error);
      res.status(500).json({
        message: 'Error updating task template',
        error: error.message
      });
    }
  },

  // Delete a task template
  deleteTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const template = await TaskTemplate.findById(id);
      if (!template) {
        res.status(404).json({
          message: 'Task template not found'
        });
        return;
      }

      // Check permissions (creator or admin)
      const isCreator = template.createdBy.toString() === req.user?.userId;
      const isAdmin = req.user?.role === 'admin';

      if (!isCreator && !isAdmin) {
        res.status(403).json({
          message: 'You can only delete templates created by you'
        });
        return;
      }

      await TaskTemplate.findByIdAndDelete(id);

      res.json({
        message: 'Task template deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting task template:', error);
      res.status(500).json({
        message: 'Error deleting task template',
        error: error.message
      });
    }
  },

  // Get template categories
  getTemplateCategories: async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await TaskTemplate.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json(categories);
    } catch (error: any) {
      console.error('Error fetching template categories:', error);
      res.status(500).json({
        message: 'Error fetching template categories',
        error: error.message
      });
    }
  },

  // Duplicate a template
  duplicateTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const originalTemplate = await TaskTemplate.findById(id);
      if (!originalTemplate) {
        res.status(404).json({
          message: 'Task template not found'
        });
        return;
      }

      const templateData = {
        ...originalTemplate.toObject(),
        _id: undefined,
        name: name || `${originalTemplate.name} (Copy)`,
        createdBy: req.user?.userId,
        createdAt: undefined,
        updatedAt: undefined
      };

      const newTemplate = await TaskTemplate.create(templateData);

      res.status(201).json({
        message: 'Task template duplicated successfully',
        template: newTemplate
      });
    } catch (error: any) {
      console.error('Error duplicating task template:', error);
      res.status(500).json({
        message: 'Error duplicating task template',
        error: error.message
      });
    }
  }
};
