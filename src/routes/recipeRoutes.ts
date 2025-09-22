import express from 'express';
import { recipeController } from '../controllers/recipeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/', recipeController.create);
router.get('/', recipeController.list);
router.get('/:id', recipeController.getById);
router.put('/:id', recipeController.update);
router.delete('/:id', recipeController.remove);

export default router;


