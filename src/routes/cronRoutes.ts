import express from 'express';
import { taskScheduler } from '../services/taskScheduler';

const router = express.Router();

// Vercel cron job endpoints (no auth required for internal cron)
router.post('/generate-daily-tasks', async (req, res) => {
  try {
    console.log('Vercel cron: Generating daily tasks...');
    await taskScheduler.generateDailyTasks();
    res.status(200).json({ 
      message: 'Daily tasks generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in daily task generation cron:', error);
    res.status(500).json({ 
      message: 'Error generating daily tasks',
      error: error.message 
    });
  }
});

router.post('/generate-weekly-tasks', async (req, res) => {
  try {
    console.log('Vercel cron: Generating weekly tasks...');
    await taskScheduler.generateWeeklyTasks();
    res.status(200).json({ 
      message: 'Weekly tasks generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in weekly task generation cron:', error);
    res.status(500).json({ 
      message: 'Error generating weekly tasks',
      error: error.message 
    });
  }
});

router.post('/generate-monthly-tasks', async (req, res) => {
  try {
    console.log('Vercel cron: Generating monthly tasks...');
    await taskScheduler.generateMonthlyTasks();
    res.status(200).json({ 
      message: 'Monthly tasks generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in monthly task generation cron:', error);
    res.status(500).json({ 
      message: 'Error generating monthly tasks',
      error: error.message 
    });
  }
});

export default router;
