import express from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.put('/:id', authMiddleware, userController.updateUser);

// Protected routes
router.get('/me', authMiddleware, userController.getMe);

export default router;