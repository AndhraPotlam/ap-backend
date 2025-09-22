import express from 'express';
import { dayPlanController } from '../controllers/dayPlanController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/', dayPlanController.create);
router.get('/', dayPlanController.list);
router.post('/:id/generate-tasks', dayPlanController.generateTasks);

export default router;


