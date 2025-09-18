import { Request, Response } from 'express';
import { Task, ITask } from '../models/Task';
import { TaskTemplate } from '../models/TaskTemplate';
import { User } from '../models/User';
import { taskScheduler } from '../services/taskScheduler';

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
  getAllTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        taskOwner,
        taskFor,
        checklistType,
        priority,
        assignedBy,
        search,
        date
      } = req.query;

      const filter: any = {};

      // Apply filters
      if (status) filter.status = status;
      if (taskOwner) filter.taskOwner = taskOwner;
      if (taskFor) filter.taskFor = taskFor;
      if (checklistType) filter.checklistType = checklistType;
      if (priority) filter.priority = priority;
      if (assignedBy) filter.assignedBy = assignedBy;

      // Date filter - filter by dueDate or createdAt
      if (date) {
        const filterDate = new Date(date as string);
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.$or = [
          { dueDate: { $gte: startOfDay, $lte: endOfDay } },
          { createdAt: { $gte: startOfDay, $lte: endOfDay } }
        ];
      }

      // Search filter
      if (search) {
        const searchFilter = {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { notes: { $regex: search, $options: 'i' } }
          ]
        };
        
        if (filter.$or) {
          // If date filter exists, combine with search filter
          filter.$and = [
            { $or: filter.$or },
            searchFilter
          ];
          delete filter.$or;
        } else {
          filter.$or = searchFilter.$or;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);

      const tasks = await Task.find(filter)
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title')
        .sort({ createdAt: -1 })
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

  // Get tasks for a specific user
  getUserTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { status, checklistType, taskFor } = req.query;

      const filter: any = { taskOwner: userId };

      if (status) filter.status = status;
      if (checklistType) filter.checklistType = checklistType;
      if (taskFor) filter.taskFor = taskFor;

      const tasks = await Task.find(filter)
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title')
        .sort({ createdAt: -1 });

      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching user tasks:', error);
      res.status(500).json({
        message: 'Error fetching user tasks',
        error: error.message
      });
    }
  },

  // Get a single task by ID
  getTaskById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const task = await Task.findById(id)
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title')
        .populate('subtasks', 'title status');

      if (!task) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      res.json({
        task
      });
    } catch (error: any) {
      console.error('Error fetching task:', error);
      res.status(500).json({
        message: 'Error fetching task',
        error: error.message
      });
    }
  },

  // Update a task
  updateTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if task exists
      const existingTask = await Task.findById(id);
      if (!existingTask) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      // Check permissions (task owner, assigned by, or admin)
      const isOwner = existingTask.taskOwner.toString() === req.user?.userId;
      const isAssignedBy = existingTask.assignedBy.toString() === req.user?.userId;
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAssignedBy && !isAdmin) {
        res.status(403).json({
          message: 'You can only update tasks assigned to you or by you'
        });
        return;
      }

      // Handle status changes
      if (updateData.status) {
        if (updateData.status === 'in_progress' && !existingTask.startTime) {
          updateData.startTime = new Date();
        }
        if (updateData.status === 'completed') {
          updateData.endTime = new Date();
          updateData.completedAt = new Date();
        }
      }

      const task = await Task.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('taskOwner', 'firstName lastName email')
        .populate('assignedBy', 'firstName lastName email')
        .populate('parentTask', 'title');

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

  // Delete a task
  deleteTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const task = await Task.findById(id);
      if (!task) {
        res.status(404).json({
          message: 'Task not found'
        });
        return;
      }

      // Check permissions (assigned by or admin)
      const isAssignedBy = task.assignedBy.toString() === req.user?.userId;
      const isAdmin = req.user?.role === 'admin';

      if (!isAssignedBy && !isAdmin) {
        res.status(403).json({
          message: 'You can only delete tasks assigned by you'
        });
        return;
      }

      await Task.findByIdAndDelete(id);

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
      const { taskOwner, taskFor, dateRange } = req.query;

      const filter: any = {};
      if (taskOwner) filter.taskOwner = taskOwner;
      if (taskFor) filter.taskFor = taskFor;

      // Date range filter
      if (dateRange && typeof dateRange === 'string') {
        const [startDate, endDate] = dateRange.split(',');
        if (startDate && endDate) {
          filter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
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

      const result = await taskScheduler.generateTasksForDateRange(
        new Date(startDate),
        new Date(endDate),
        checklistType
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error generating tasks for date range:', error);
      res.status(500).json({
        message: 'Error generating tasks for date range',
        error: error.message
      });
    }
  },

  // Generate tasks for specific date
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

      const result = await taskScheduler.generateTasksForDate(
        new Date(date),
        checklistType
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error generating tasks for date:', error);
      res.status(500).json({
        message: 'Error generating tasks for date',
        error: error.message
      });
    }
  },

  // Get scheduler status
  getSchedulerStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const status = taskScheduler.getStatus();
      res.status(200).json(status);
    } catch (error: any) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({
        message: 'Error getting scheduler status',
        error: error.message
      });
    }
  },

  // Start scheduler
  startScheduler: async (req: Request, res: Response): Promise<void> => {
    try {
      taskScheduler.start();
      res.status(200).json({
        message: 'Task scheduler started successfully'
      });
    } catch (error: any) {
      console.error('Error starting scheduler:', error);
      res.status(500).json({
        message: 'Error starting scheduler',
        error: error.message
      });
    }
  },

  // Stop scheduler
  stopScheduler: async (req: Request, res: Response): Promise<void> => {
    try {
      taskScheduler.stop();
      res.status(200).json({
        message: 'Task scheduler stopped successfully'
      });
    } catch (error: any) {
      console.error('Error stopping scheduler:', error);
      res.status(500).json({
        message: 'Error stopping scheduler',
        error: error.message
      });
    }
  },

  // Manual trigger for daily tasks (for testing/debugging)
  triggerDailyTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      await taskScheduler.generateDailyTasks();
      res.status(200).json({
        message: 'Daily tasks generated successfully'
      });
    } catch (error: any) {
      console.error('Error triggering daily tasks:', error);
      res.status(500).json({
        message: 'Error generating daily tasks',
        error: error.message
      });
    }
  },

  // Manual trigger for weekly tasks (for testing/debugging)
  triggerWeeklyTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      await taskScheduler.generateWeeklyTasks();
      res.status(200).json({
        message: 'Weekly tasks generated successfully'
      });
    } catch (error: any) {
      console.error('Error triggering weekly tasks:', error);
      res.status(500).json({
        message: 'Error generating weekly tasks',
        error: error.message
      });
    }
  },

  // Manual trigger for monthly tasks (for testing/debugging)
  triggerMonthlyTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      await taskScheduler.generateMonthlyTasks();
      res.status(200).json({
        message: 'Monthly tasks generated successfully'
      });
    } catch (error: any) {
      console.error('Error triggering monthly tasks:', error);
      res.status(500).json({
        message: 'Error generating monthly tasks',
        error: error.message
      });
    }
  }
};
