import express from 'express';
import { recipeProcessController } from '../controllers/recipeProcessController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/', recipeProcessController.create);
router.get('/', recipeProcessController.list);
router.get('/:id', recipeProcessController.getById);
router.put('/:id', recipeProcessController.update);
router.delete('/:id', recipeProcessController.remove);

export default router;


