import express from 'express';
import { categoryController } from '../controllers/categoryController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.get('/', categoryController.getAllCategories);

// Protected routes (admin only)
router.post('/', authMiddleware, categoryController.createCategory);
router.put('/:id', authMiddleware, categoryController.updateCategory);
router.delete('/:id', authMiddleware, categoryController.deleteCategory);

// This route should be last to avoid catching other routes
router.get('/:id', authMiddleware, categoryController.getCategory);

export default router; 