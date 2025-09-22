import express from 'express';
import { expenseController } from '../controllers/expenseController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/', expenseController.create);
router.get('/', expenseController.list);
router.get('/summary', expenseController.summary);
router.get('/:id', expenseController.getById);
router.put('/:id', expenseController.update);
router.delete('/:id', expenseController.remove);

export default router;


