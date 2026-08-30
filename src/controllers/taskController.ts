import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { startOfDay, endOfDay, isSameWeek, isSameMonth } from 'date-fns';
import { formatDoc, formatDocs } from '../utils/format';

function formatTask(task: any) {
  if (!task) return null;
  return {
    ...task,
    _id: task.id,
    taskOwner: task.taskOwner ? { ...task.taskOwner, _id: task.taskOwner.id } : task.taskOwnerId,
    assignedBy: task.assignedBy ? { ...task.assignedBy, _id: task.assignedBy.id } : task.assignedById,
    parentTask: task.parentTask ? { ...task.parentTask, _id: task.parentTask.id } : task.parentTaskId,
    subtasks: task.subtasks?.map((st: any) => ({ ...st, _id: st.id })) || [],
  };
}

export const taskController = {
  createTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        title,
        description,
        taskFor = 'hotel',
        taskOwner,
        priority = 'medium',
        procedure,
        checklistType = 'custom',
        dueDate,
        notes,
        location,
        estimatedDuration,
        tags = [],
        isRecurring = false,
        recurringPattern,
        parentTask,
      } = req.body;
      const assignedById = req.user?.userId || req.user?._id || req.user?.id;

      if (!title || !description || !taskOwner) {
        res.status(400).json({ message: 'Title, description, and task owner are required' });
        return;
      }

      const taskOwnerId = typeof taskOwner === 'object' ? taskOwner?.id || taskOwner?._id : taskOwner;
      const owner = await prisma.user.findUnique({ where: { id: taskOwnerId } });
      if (!owner) {
        res.status(400).json({ message: 'Task owner not found' });
        return;
      }

      const parentTaskId = parentTask ? (typeof parentTask === 'object' ? parentTask?.id || parentTask?._id : parentTask) : null;

      const task = await prisma.task.create({
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          taskFor,
          taskOwnerId,
          assignedById: assignedById || taskOwnerId,
          priority: priority as any,
          procedure: procedure ? String(procedure).trim() : null,
          checklistType: checklistType as any,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes?.trim() || null,
          location: location || null,
          estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
          tags: Array.isArray(tags) ? tags : [],
          isRecurring: Boolean(isRecurring),
          recurringPattern: recurringPattern || null,
          parentTaskId: parentTaskId || null,
        },
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          parentTask: { select: { id: true, title: true } },
        },
      });

      res.status(201).json({
        message: 'Task created successfully',
        task: formatTask(task),
      });
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({ message: 'Error creating task', error: error.message });
    }
  },

  getAllTasks: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        taskFor,
        checklistType,
        taskOwner,
        startDate,
        endDate,
        search,
      } = req.query;

      const where: any = {};
      if (status) where.status = status as any;
      if (priority) where.priority = priority as any;
      if (taskFor) where.taskFor = String(taskFor);
      if (checklistType) where.checklistType = checklistType as any;
      if (taskOwner) where.taskOwnerId = String(taskOwner);

      if (startDate || endDate) {
        where.dueDate = {};
        if (startDate) where.dueDate.gte = new Date(startDate as string);
        if (endDate) where.dueDate.lte = new Date(endDate as string);
      }

      if (search) {
        where.OR = [
          { title: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            parentTask: { select: { id: true, title: true } },
          },
          orderBy: { dueDate: 'asc' },
          skip,
          take,
        }),
        prisma.task.count({ where }),
      ]);

      res.json({
        tasks: tasks.map(formatTask),
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / take),
          total,
        },
      });
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Error fetching tasks', error: error.message });
    }
  },

  getTaskById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          parentTask: { select: { id: true, title: true } },
          subtasks: true,
        },
      });

      if (!task) {
        res.status(404).json({ message: 'Task not found' });
        return;
      }

      res.json({ task: formatTask(task) });
    } catch (error: any) {
      console.error('Error fetching task:', error);
      res.status(500).json({ message: 'Error fetching task', error: error.message });
    }
  },

  updateTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
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
        actualDuration,
        tags,
        isRecurring,
        recurringPattern,
        parentTask,
        status,
      } = req.body;

      const dataToUpdate: any = {};
      if (title !== undefined) dataToUpdate.title = String(title).trim();
      if (description !== undefined) dataToUpdate.description = String(description).trim();
      if (taskFor !== undefined) dataToUpdate.taskFor = taskFor;
      if (taskOwner !== undefined) dataToUpdate.taskOwnerId = typeof taskOwner === 'object' ? taskOwner?.id || taskOwner?._id : taskOwner;
      if (priority !== undefined) dataToUpdate.priority = priority;
      if (procedure !== undefined) dataToUpdate.procedure = procedure;
      if (checklistType !== undefined) dataToUpdate.checklistType = checklistType;
      if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
      if (notes !== undefined) dataToUpdate.notes = notes;
      if (location !== undefined) dataToUpdate.location = location;
      if (estimatedDuration !== undefined) dataToUpdate.estimatedDuration = Number(estimatedDuration);
      if (actualDuration !== undefined) dataToUpdate.actualDuration = Number(actualDuration);
      if (tags !== undefined) dataToUpdate.tags = tags;
      if (isRecurring !== undefined) dataToUpdate.isRecurring = Boolean(isRecurring);
      if (recurringPattern !== undefined) dataToUpdate.recurringPattern = recurringPattern;
      if (parentTask !== undefined) dataToUpdate.parentTaskId = parentTask ? (typeof parentTask === 'object' ? parentTask?.id || parentTask?._id : parentTask) : null;
      if (status !== undefined) {
        dataToUpdate.status = status;
        if (status === 'completed') dataToUpdate.completedAt = new Date();
      }

      const task = await prisma.task.update({
        where: { id },
        data: dataToUpdate,
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          parentTask: { select: { id: true, title: true } },
        },
      });

      res.json({
        message: 'Task updated successfully',
        task: formatTask(task),
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({ message: 'Error updating task', error: error.message });
    }
  },

  updateTaskStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({ message: 'Status is required' });
        return;
      }

      const dataToUpdate: any = { status };
      if (status === 'completed') {
        dataToUpdate.completedAt = new Date();
      }

      const task = await prisma.task.update({
        where: { id },
        data: dataToUpdate,
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json({
        message: 'Task status updated successfully',
        task: formatTask(task),
      });
    } catch (error: any) {
      console.error('Error updating task status:', error);
      res.status(500).json({ message: 'Error updating task status', error: error.message });
    }
  },

  deleteTask: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.task.delete({ where: { id } });
      res.json({ message: 'Task deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({ message: 'Error deleting task', error: error.message });
    }
  },

  getTasksByDate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { date } = req.params;
      const targetDate = new Date(date);

      const start = startOfDay(targetDate);
      const end = endOfDay(targetDate);

      const tasks = await prisma.task.findMany({
        where: {
          dueDate: { gte: start, lte: end },
        },
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      res.json(tasks.map(formatTask));
    } catch (error: any) {
      console.error('Error fetching tasks by date:', error);
      res.status(500).json({ message: 'Error fetching tasks by date', error: error.message });
    }
  },

  getTasksByUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const tasks = await prisma.task.findMany({
        where: { taskOwnerId: userId },
        include: {
          taskOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      res.json(tasks.map(formatTask));
    } catch (error: any) {
      console.error('Error fetching tasks by user:', error);
      res.status(500).json({ message: 'Error fetching tasks by user', error: error.message });
    }
  },

  generateTasksFromTemplates: async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, checklistType, defaultAssigneeId } = req.body;
      const assignedById = req.user?.userId || req.user?._id || req.user?.id;

      const targetDate = date ? new Date(date) : new Date();
      const where: any = { isActive: true };
      if (checklistType) where.checklistType = checklistType;

      const templates = await prisma.taskTemplate.findMany({ where });

      const createdTasks = [];
      for (const tmpl of templates) {
        const taskOwnerId = defaultAssigneeId || tmpl.createdById || assignedById;
        const task = await prisma.task.create({
          data: {
            title: tmpl.name,
            description: tmpl.description,
            taskFor: tmpl.taskFor,
            taskOwnerId,
            assignedById,
            priority: tmpl.priority,
            procedure: tmpl.procedure,
            checklistType: tmpl.checklistType,
            dueDate: targetDate,
            estimatedDuration: tmpl.estimatedDuration,
            tags: tmpl.tags,
            location: tmpl.location || null,
          },
        });
        createdTasks.push(formatTask(task));
      }

      res.status(201).json({
        message: 'Tasks generated successfully',
        tasks: createdTasks,
      });
    } catch (error: any) {
      console.error('Error generating tasks from templates:', error);
      res.status(500).json({ message: 'Error generating tasks from templates', error: error.message });
    }
  },

  getTaskStats: async (req: Request, res: Response): Promise<void> => {
    try {
      const [total, pending, inProgress, completed, cancelled] = await Promise.all([
        prisma.task.count(),
        prisma.task.count({ where: { status: 'pending' } }),
        prisma.task.count({ where: { status: 'in_progress' } }),
        prisma.task.count({ where: { status: 'completed' } }),
        prisma.task.count({ where: { status: 'cancelled' } }),
      ]);

      res.json({
        total,
        pending,
        inProgress,
        completed,
        cancelled,
      });
    } catch (error: any) {
      console.error('Error fetching task stats:', error);
      res.status(500).json({ message: 'Error fetching task stats', error: error.message });
    }
  },

  getTasks: async (req: Request, res: Response): Promise<void> => {
    return taskController.getAllTasks(req, res);
  },

  generateTasksForDate: async (req: Request, res: Response): Promise<void> => {
    return taskController.generateTasksFromTemplates(req, res);
  },

  generateTasksForDateRange: async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, checklistType, defaultAssigneeId } = req.body;
      const assignedById = req.user?.userId || req.user?._id || req.user?.id;

      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date();

      const templates = await prisma.taskTemplate.findMany({
        where: {
          isActive: true,
          ...(checklistType ? { checklistType: checklistType as any } : {}),
        },
      });

      const createdTasks = [];
      const curr = new Date(start);

      while (curr <= end) {
        for (const tmpl of templates) {
          const taskOwnerId = defaultAssigneeId || tmpl.createdById || assignedById;
          const task = await prisma.task.create({
            data: {
              title: tmpl.name,
              description: tmpl.description,
              taskFor: tmpl.taskFor,
              taskOwnerId,
              assignedById,
              priority: tmpl.priority,
              procedure: tmpl.procedure,
              checklistType: tmpl.checklistType,
              dueDate: new Date(curr),
              estimatedDuration: tmpl.estimatedDuration,
              tags: tmpl.tags,
              location: tmpl.location || null,
            },
          });
          createdTasks.push(formatTask(task));
        }
        curr.setDate(curr.getDate() + 1);
      }

      res.status(201).json({
        message: 'Tasks generated successfully for date range',
        tasks: createdTasks,
      });
    } catch (error: any) {
      console.error('Error generating tasks for date range:', error);
      res.status(500).json({ message: 'Error generating tasks for date range', error: error.message });
    }
  },
};