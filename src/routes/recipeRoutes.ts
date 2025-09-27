import express from 'express';
import { recipeController } from '../controllers/recipeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Recipe routes
router.get('/', recipeController.getAll);
router.get('/categories', recipeController.getCategories);
router.get('/category/:category', recipeController.getByCategory);
router.get('/:id', recipeController.getById);
router.get('/:id/cost', recipeController.calculateCost);
router.post('/', recipeController.create);
router.put('/:id', recipeController.update);
router.delete('/:id', recipeController.delete);

export default router;
