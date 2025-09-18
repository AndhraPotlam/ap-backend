import { Task, ITask } from '../models/Task';
import { TaskTemplate } from '../models/TaskTemplate';
import { User } from '../models/User';

export class TaskScheduler {
  private static instance: TaskScheduler;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  // Start the scheduler (for serverless, this just sets status)
  public start(): void {
    this.isRunning = true;
    console.log('Task scheduler initialized for Vercel serverless deployment');
    console.log('Cron jobs will be handled by Vercel cron functions');
  }

  // Stop the scheduler (for serverless, this just sets status)
  public stop(): void {
    this.isRunning = false;
    console.log('Task scheduler stopped (serverless mode)');
  }

  // Generate daily tasks from templates (public for cron access)
  public async generateDailyTasks(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if daily tasks for today already exist
      const existingTasks = await Task.find({
        checklistType: 'daily',
        createdAt: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (existingTasks.length > 0) {
        console.log(`Daily tasks for ${today.toDateString()} already exist (${existingTasks.length} tasks)`);
        return;
      }

      // Get all daily task templates
      const dailyTemplates = await TaskTemplate.find({
        checklistType: 'daily',
        isActive: true
      });

      if (dailyTemplates.length === 0) {
        console.log('No daily task templates found');
        return;
      }

      // Get all active users (task owners)
      const users = await User.find({ isActive: true });

      if (users.length === 0) {
        console.log('No active users found for task assignment');
        return;
      }

      const tasks = [];

      // Create tasks for each template and user combination
      for (const template of dailyTemplates) {
        for (const user of users) {
          // Check if user should be assigned this task based on role or preferences
          if (this.shouldAssignTaskToUser(template, user)) {
            const taskData: Partial<ITask> = {
              title: template.name,
              description: template.description,
              taskFor: template.taskFor,
              taskOwner: user._id as any,
              assignedBy: template.createdBy as any, // System assignment
              priority: template.priority,
              procedure: template.procedure,
              checklistType: 'daily',
              dueDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // End of day
              location: template.location,
              estimatedDuration: template.estimatedDuration,
              tags: template.tags,
              notes: template.safetyNotes,
              isRecurring: false, // Individual daily instances are not recurring
              status: 'pending'
            };

            const task = await Task.create(taskData);
            tasks.push(task);
          }
        }
      }

      console.log(`Generated ${tasks.length} daily tasks for ${today.toDateString()}`);
    } catch (error) {
      console.error('Error generating daily tasks:', error);
    }
  }

  // Generate weekly tasks from templates (public for cron access)
  public async generateWeeklyTasks(): Promise<void> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);

      // Check if weekly tasks for this week already exist
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const existingTasks = await Task.find({
        checklistType: 'weekly',
        createdAt: {
          $gte: startOfWeek,
          $lt: endOfWeek
        }
      });

      if (existingTasks.length > 0) {
        console.log(`Weekly tasks for week of ${startOfWeek.toDateString()} already exist (${existingTasks.length} tasks)`);
        return;
      }

      // Get all weekly task templates
      const weeklyTemplates = await TaskTemplate.find({
        checklistType: 'weekly',
        isActive: true
      });

      if (weeklyTemplates.length === 0) {
        console.log('No weekly task templates found');
        return;
      }

      // Get all active users
      const users = await User.find({ isActive: true });

      const tasks = [];

      for (const template of weeklyTemplates) {
        for (const user of users) {
          if (this.shouldAssignTaskToUser(template, user)) {
            const taskData: Partial<ITask> = {
              title: template.name,
              description: template.description,
              taskFor: template.taskFor,
              taskOwner: user._id as any,
              assignedBy: template.createdBy as any,
              priority: template.priority,
              procedure: template.procedure,
              checklistType: 'weekly',
              dueDate: new Date(endOfWeek.getTime() - 1), // End of week
              location: template.location,
              estimatedDuration: template.estimatedDuration,
              tags: template.tags,
              notes: template.safetyNotes,
              isRecurring: false,
              status: 'pending'
            };

            const task = await Task.create(taskData);
            tasks.push(task);
          }
        }
      }

      console.log(`Generated ${tasks.length} weekly tasks for week of ${startOfWeek.toDateString()}`);
    } catch (error) {
      console.error('Error generating weekly tasks:', error);
    }
  }

  // Generate monthly tasks from templates (public for cron access)
  public async generateMonthlyTasks(): Promise<void> {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Check if monthly tasks for this month already exist
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const existingTasks = await Task.find({
        checklistType: 'monthly',
        createdAt: {
          $gte: startOfMonth,
          $lt: endOfMonth
        }
      });

      if (existingTasks.length > 0) {
        console.log(`Monthly tasks for ${startOfMonth.toDateString()} already exist (${existingTasks.length} tasks)`);
        return;
      }

      // Get all monthly task templates
      const monthlyTemplates = await TaskTemplate.find({
        checklistType: 'monthly',
        isActive: true
      });

      if (monthlyTemplates.length === 0) {
        console.log('No monthly task templates found');
        return;
      }

      // Get all active users
      const users = await User.find({ isActive: true });

      const tasks = [];

      for (const template of monthlyTemplates) {
        for (const user of users) {
          if (this.shouldAssignTaskToUser(template, user)) {
            const taskData: Partial<ITask> = {
              title: template.name,
              description: template.description,
              taskFor: template.taskFor,
              taskOwner: user._id as any,
              assignedBy: template.createdBy as any,
              priority: template.priority,
              procedure: template.procedure,
              checklistType: 'monthly',
              dueDate: new Date(endOfMonth.getTime() - 1), // End of month
              location: template.location,
              estimatedDuration: template.estimatedDuration,
              tags: template.tags,
              notes: template.safetyNotes,
              isRecurring: false,
              status: 'pending'
            };

            const task = await Task.create(taskData);
            tasks.push(task);
          }
        }
      }

      console.log(`Generated ${tasks.length} monthly tasks for ${startOfMonth.toDateString()}`);
    } catch (error) {
      console.error('Error generating monthly tasks:', error);
    }
  }

  // Determine if a task should be assigned to a specific user
  private shouldAssignTaskToUser(template: any, user: any): boolean {
    // Add logic here to determine task assignment based on:
    // - User role
    // - User preferences
    // - Task requirements
    // - Workload balancing
    
    // For now, assign all tasks to all users
    // You can customize this based on your business logic
    return true;
  }

  // Manual task generation for specific date range
  public async generateTasksForDateRange(
    startDate: Date, 
    endDate: Date, 
    checklistType: 'daily' | 'weekly' | 'monthly'
  ): Promise<{ message: string; tasksCreated: number }> {
    try {
      const templates = await TaskTemplate.find({
        checklistType,
        isActive: true
      });

      if (templates.length === 0) {
        return { message: `No ${checklistType} task templates found`, tasksCreated: 0 };
      }

      const users = await User.find({ isActive: true });
      const tasks = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        // Check if tasks for this date already exist
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const existingTasks = await Task.find({
          checklistType,
          createdAt: {
            $gte: dayStart,
            $lt: dayEnd
          }
        });

        if (existingTasks.length === 0) {
          for (const template of templates) {
            for (const user of users) {
              if (this.shouldAssignTaskToUser(template, user)) {
                const taskData: Partial<ITask> = {
                  title: template.name,
                  description: template.description,
                  taskFor: template.taskFor,
                  taskOwner: user._id as any,
                  assignedBy: template.createdBy as any,
                  priority: template.priority,
                  procedure: template.procedure,
                  checklistType,
                  dueDate: dayEnd,
                  location: template.location,
                  estimatedDuration: template.estimatedDuration,
                  tags: template.tags,
                  notes: template.safetyNotes,
                  isRecurring: false,
                  status: 'pending'
                };

                const task = await Task.create(taskData);
                tasks.push(task);
              }
            }
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        message: `Generated ${tasks.length} ${checklistType} tasks for date range`,
        tasksCreated: tasks.length
      };
    } catch (error) {
      console.error('Error generating tasks for date range:', error);
      throw error;
    }
  }

  // Generate tasks for specific date
  public async generateTasksForDate(
    date: Date,
    checklistType: 'daily' | 'weekly' | 'monthly'
  ): Promise<{ message: string; tasksCreated: number }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.generateTasksForDateRange(startOfDay, endOfDay, checklistType);
  }

  // Get scheduler status
  public getStatus(): { isRunning: boolean; message: string } {
    return {
      isRunning: this.isRunning,
      message: this.isRunning ? 'Task scheduler is running' : 'Task scheduler is stopped'
    };
  }
}

export const taskScheduler = TaskScheduler.getInstance();
