import { Request, Response } from 'express';
import { Task, ITask } from '../models/Task';
import { TaskTemplate } from '../models/TaskTemplate';
import { User } from '../models/User';
import { startOfDay, endOfDay, addDays, addWeeks, addMonths, isSameDay, isSameWeek, isSameMonth } from 'date-fns';

// Helper function to determine if a task should be generated for a specific date
const shouldGenerateTaskForDate = (targetDate: Date, checklistType: string, startDate: Date): boolean => {
  switch (checklistType) {
    case 'daily':
      return true; // Generate for every day
    case 'weekly':
      // Generate only if the target date is in the same week as the start date
      return isSameWeek(targetDate, startDate, { weekStartsOn: 1 }); // Monday start
    case 'monthly':
      // Generate only if the target date is in the same month as the start date
      return isSameMonth(targetDate, startDate);
    default:
      return false;
  }
};

export const taskController = {
  // Create a new task
  createTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        title,
        description,
        taskFor,
        taskOwner,
        priority,
        procedure,
        checklistType,
        dueDate,
        notes,
        location,
        estimatedDuration,
        tags,
        isRecurring,
        recurringPattern,
        parentTask
      } = req.body;

      // Validate required fields
      if (!title || !description || !taskOwner) {
        res.status(400).json({
          message: 'Title, description, and task owner are required'
        });
        return;
      }

      // Check if task owner exists
      const owner = await User.findById(taskOwner);
      if (!owner) {
        res.status(400).json({
          message: 'Task owner not found'
        });
        return;
      }

      const taskData: Partial<ITask> = {
        title,
        description,
        taskFor: taskFor || 'hotel',
        taskOwner,
        assignedBy: req.user?.userId,
        priority: priority || 'medium',
        procedure,
        checklistType: checklistType || 'custom',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        location,
        estimatedDuration,
        tags,
        isRecurring: isRecurring || false,
        recurringPattern,
        parentTask
      };

      const task = await Task.create(taskData);

      // Populate the created task
      const populatedTask = await Task.findById(task._id)
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title');

      res.status(201).json({
        message: 'Task created successfully',
        task: populatedTask
      });
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({
        message: 'Error creating task',
        error: error.message
      });
    }
  },

  // Get all tasks with filtering and pagination
  getTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        taskFor,
        taskOwner,
        assignedBy,
        checklistType,
        search,
        date,
        startDate,
        endDate
      } = req.query;

      const filter: any = {};

      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (taskFor) filter.taskFor = taskFor;
      if (taskOwner) filter.taskOwner = taskOwner;
      if (assignedBy) filter.assignedBy = assignedBy;
      if (checklistType) filter.checklistType = checklistType;

      // Date filters - support single "date" or range via startDate/endDate
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        const rangeCondition: any = {};
        if (start) rangeCondition.$gte = start;
        if (end) rangeCondition.$lte = end;

        if (rangeCondition.$gte || rangeCondition.$lte) {
          filter.$or = [
            { dueDate: rangeCondition },
            { createdAt: rangeCondition }
          ];
        }
      } else if (date) {
        // Backward-compatible single-day filter
        const filterDate = new Date(date as string);
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.$or = [
          { title: { $regex: search as string, $options: 'i' } },
          { description: { $regex: search as string, $options: 'i' } },
          { notes: { $regex: search as string, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const tasks = await Task.find(filter)
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title')
        .sort({ dueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Task.countDocuments(filter);

      res.json({
        tasks,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total
        }
      });
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({
        message: 'Error fetching tasks',
        error: error.message
      });
    }
  },

  // Get task by ID
  getTaskById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const task = await Task.findById(id)
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title')
        .populate('subtasks');

      if (!task) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      res.json({ task });
    } catch (error: any) {
      console.error('Error fetching task:', error);
      res.status(500).json({
        message: 'Error fetching task',
        error: error.message
      });
    }
  },

  // Update task
  updateTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Handle status change to completed
      if (updateData.status === 'completed' && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }

      const task = await Task.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title');

      if (!task) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      res.json({
        message: 'Task updated successfully',
        task
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({
        message: 'Error updating task',
        error: error.message
      });
    }
  },

  // Delete task
  deleteTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const task = await Task.findByIdAndDelete(id);

      if (!task) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      res.json({
        message: 'Task deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({
        message: 'Error deleting task',
        error: error.message
      });
    }
  },

  // Generate tasks from template
  generateTasksFromTemplate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateIds, taskOwners, dueDate, checklistType } = req.body;

      if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
        res.status(400).json({
          message: 'Template IDs are required'
        });
        return;
      }

      if (!taskOwners || !Array.isArray(taskOwners) || taskOwners.length === 0) {
        res.status(400).json({
          message: 'Task owners are required'
        });
        return;
      }

      const templates = await TaskTemplate.find({
        _id: { $in: templateIds },
        isActive: true
      });

      if (templates.length === 0) {
        res.status(404).json({
          message: 'No active templates found'
        });
        return;
      }

      const tasks = [];

      for (const template of templates) {
        for (const ownerId of taskOwners) {
          const taskData = {
            title: template.name,
            description: template.description,
            taskFor: template.taskFor,
            taskOwner: ownerId,
            assignedBy: req.user?.userId,
            priority: template.priority,
            procedure: template.procedure,
            checklistType: checklistType || template.checklistType,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            location: template.location,
            estimatedDuration: template.estimatedDuration,
            tags: template.tags,
            notes: template.safetyNotes
          };

          const task = await Task.create(taskData);
          tasks.push(task);
        }
      }

      res.status(201).json({
        message: 'Tasks generated successfully',
        tasks,
        count: tasks.length
      });
    } catch (error: any) {
      console.error('Error generating tasks from template:', error);
      res.status(500).json({
        message: 'Error generating tasks from template',
        error: error.message
      });
    }
  },

  // Get task statistics
  getTaskStats: async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskOwner, taskFor, dateRange, startDate, endDate } = req.query;

      const filter: any = {};
      if (taskOwner) filter.taskOwner = taskOwner;
      if (taskFor) filter.taskFor = taskFor;

      // Date range filter - support dateRange or startDate/endDate params
      if (dateRange && typeof dateRange === 'string') {
        const [start, end] = dateRange.split(',');
        if (start && end) {
          filter.createdAt = {
            $gte: new Date(start),
            $lte: new Date(end)
          };
        }
      } else if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;
        if (start || end) {
          const createdAt: any = {};
          if (start) createdAt.$gte = new Date(start);
          if (end) createdAt.$lte = new Date(end);
          filter.createdAt = createdAt;
        }
      }

      const stats = await Task.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
            },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            onHold: {
              $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] }
            },
            avgTimeTaken: { $avg: '$timeTaken' },
            totalTimeTaken: { $sum: '$timeTaken' }
          }
        }
      ]);

      const checklistStats = await Task.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$checklistType',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        overview: stats[0] || {
          total: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          onHold: 0,
          avgTimeTaken: 0,
          totalTimeTaken: 0
        },
        checklistBreakdown: checklistStats
      });
    } catch (error: any) {
      console.error('Error fetching task stats:', error);
      res.status(500).json({
        message: 'Error fetching task stats',
        error: error.message
      });
    }
  },

  // Generate tasks for specific date range
  generateTasksForDateRange: async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, checklistType } = req.body;

      if (!startDate || !endDate || !checklistType) {
        res.status(400).json({
          message: 'Start date, end date, and checklist type are required'
        });
        return;
      }

      if (!['daily', 'weekly', 'monthly'].includes(checklistType)) {
        res.status(400).json({
          message: 'Checklist type must be daily, weekly, or monthly'
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const generatedTasks = [];
      const skippedTasks = [];

      // Get all active task templates for the specified checklist type
      const templates = await TaskTemplate.find({
        checklistType,
        isActive: true
      }).populate('createdBy', 'firstName lastName');

      if (templates.length === 0) {
        res.status(200).json({
          message: 'No active task templates found for the specified checklist type',
          generatedTasks: [],
          skippedTasks: [],
          totalGenerated: 0,
          totalSkipped: 0
        });
        return;
      }

      // Generate tasks for each day in the range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const shouldGenerate = shouldGenerateTaskForDate(currentDate, checklistType, start);

        if (shouldGenerate) {
          for (const template of templates) {
            // Check if task already exists for this template and date
            const existingTask = await Task.findOne({
              title: template.name,
              dueDate: {
                $gte: startOfDay(currentDate),
                $lte: endOfDay(currentDate)
              }
            });

            if (!existingTask) {
              const taskData: Partial<ITask> = {
                title: template.name,
                description: template.description,
                taskFor: template.taskFor,
                taskOwner: template.createdBy._id,
                assignedBy: req.user?.userId,
                priority: template.priority,
                procedure: template.procedure,
                checklistType: template.checklistType,
                dueDate: currentDate,
                location: template.location,
                estimatedDuration: template.estimatedDuration,
                tags: template.tags,
                isRecurring: true,
                recurringPattern: {
                  frequency: checklistType as 'daily' | 'weekly' | 'monthly',
                  interval: 1
                }
              };

              const task = await Task.create(taskData);
              const populatedTask = await Task.findById(task._id)
                .populate('taskOwner', 'firstName lastName email')
                .populate('assignedBy', 'firstName lastName email');

              generatedTasks.push(populatedTask);
            } else {
              skippedTasks.push({
                template: template.name,
                date: currentDate,
                reason: 'Task already exists for this date'
              });
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.status(200).json({
        message: `Tasks generated successfully for ${checklistType} templates`,
        generatedTasks,
        skippedTasks,
        totalGenerated: generatedTasks.length,
        totalSkipped: skippedTasks.length,
        dateRange: { start, end },
        checklistType
      });
    } catch (error: any) {
      console.error('Error generating tasks for date range:', error);
      res.status(500).json({
        message: 'Error generating tasks for date range',
        error: error.message
      });
    }
  },

  // Generate tasks for specific date manually
  generateTasksForDate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, checklistType } = req.body;

      if (!date || !checklistType) {
        res.status(400).json({
          message: 'Date and checklist type are required'
        });
        return;
      }

      if (!['daily', 'weekly', 'monthly'].includes(checklistType)) {
        res.status(400).json({
          message: 'Checklist type must be daily, weekly, or monthly'
        });
        return;
      }

      const targetDate = new Date(date);
      const generatedTasks = [];
      const skippedTasks = [];

      // Get all active task templates for the specified checklist type
      const templates = await TaskTemplate.find({
        checklistType,
        isActive: true
      }).populate('createdBy', 'firstName lastName');

      if (templates.length === 0) {
        res.status(200).json({
          message: 'No active task templates found for the specified checklist type',
          generatedTasks: [],
          skippedTasks: [],
          totalGenerated: 0,
          totalSkipped: 0
        });
        return;
      }

      // Check if we should generate tasks for this date based on the start date logic
      const shouldGenerate = shouldGenerateTaskForDate(targetDate, checklistType, targetDate);

      if (!shouldGenerate) {
        res.status(200).json({
          message: `No tasks generated for ${checklistType} type on this date (doesn't match generation pattern)`,
          generatedTasks: [],
          skippedTasks: [],
          totalGenerated: 0,
          totalSkipped: 0
        });
        return;
      }

      for (const template of templates) {
        // Check if task already exists for this template and date
        const existingTask = await Task.findOne({
          title: template.name,
          dueDate: {
            $gte: startOfDay(targetDate),
            $lte: endOfDay(targetDate)
          }
        });

        if (!existingTask) {
          const taskData: Partial<ITask> = {
            title: template.name,
            description: template.description,
            taskFor: template.taskFor,
            taskOwner: template.createdBy._id,
            assignedBy: req.user?.userId,
            priority: template.priority,
            procedure: template.procedure,
            checklistType: template.checklistType,
            dueDate: targetDate,
            location: template.location,
            estimatedDuration: template.estimatedDuration,
            tags: template.tags,
            isRecurring: true,
            recurringPattern: {
              frequency: checklistType as 'daily' | 'weekly' | 'monthly',
              interval: 1
            }
          };

          const task = await Task.create(taskData);
          const populatedTask = await Task.findById(task._id)
            .populate('taskOwner', 'firstName lastName email')
            .populate('assignedBy', 'firstName lastName email');

          generatedTasks.push(populatedTask);
        } else {
          skippedTasks.push({
            template: template.name,
            date: targetDate,
            reason: 'Task already exists for this date'
          });
        }
      }

      res.status(200).json({
        message: `Tasks generated successfully for ${checklistType} templates`,
        generatedTasks,
        skippedTasks,
        totalGenerated: generatedTasks.length,
        totalSkipped: skippedTasks.length,
        date: targetDate,
        checklistType
      });
    } catch (error: any) {
      console.error('Error generating tasks for date:', error);
      res.status(500).json({
        message: 'Error generating tasks for date',
        error: error.message
      });
    }
  },
};