import express from 'express';
import { cartController } from '../controllers/cartController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All cart routes require authentication
router.use(authMiddleware);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateQuantity);
router.delete('/remove/:productId', cartController.removeFromCart);
router.post('/apply-coupon', cartController.applyCoupon);
router.delete('/clear', cartController.clearCart);

export default router;
