import express from 'express';
import { taskController } from '../controllers/taskController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Task routes
router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/my-tasks', taskController.getUserTasks);
router.get('/stats', taskController.getTaskStats);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.post('/generate-from-template', taskController.generateTasksFromTemplate);

// Task scheduler routes
router.post('/generate-date-range', taskController.generateTasksForDateRange);
router.post('/generate-date', taskController.generateTasksForDate);
router.get('/scheduler/status', taskController.getSchedulerStatus);
router.post('/scheduler/start', taskController.startScheduler);
router.post('/scheduler/stop', taskController.stopScheduler);

// Manual trigger routes (for testing/debugging)
router.post('/trigger/daily', taskController.triggerDailyTasks);
router.post('/trigger/weekly', taskController.triggerWeeklyTasks);
router.post('/trigger/monthly', taskController.triggerMonthlyTasks);

export default router;
