import express from 'express';
import { expenseCategoryController } from '../controllers/expenseCategoryController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/', expenseCategoryController.create);
router.get('/', expenseCategoryController.list);
router.get('/:id', expenseCategoryController.getById);
router.put('/:id', expenseCategoryController.update);
router.delete('/:id', expenseCategoryController.remove);

export default router;


