import express from 'express';
import { orderController } from '../controllers/orderController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/calculate', orderController.calculateOrderAmount);
router.post('/', orderController.createOrder);
router.get('/', orderController.getUserOrders);
router.get('/all', orderController.getAllOrders);
router.get('/my-orders', orderController.getUserOrders);
router.get('/:id', orderController.getOrder);
router.put('/:id', orderController.updateOrder);
router.patch('/:id/status', orderController.updateOrderStatus);
router.post('/:id/cancel', orderController.cancelOrder);

export default router;