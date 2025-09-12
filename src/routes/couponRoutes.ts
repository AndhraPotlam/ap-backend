import express from 'express';
import * as couponController from '../controllers/couponController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes (no auth required)
router.get('/active', couponController.getActiveCoupons);
router.post('/validate', couponController.validateCoupon);

// Protected routes (require auth)
router.use(authMiddleware);

// Get all coupons (admin only)
router.get('/', couponController.getAllCoupons);

// Get coupon by ID
router.get('/:id', couponController.getCouponById);

// Create new coupon
router.post('/', couponController.createCoupon);

// Update coupon
router.put('/:id', couponController.updateCoupon);

// Delete coupon
router.delete('/:id', couponController.deleteCoupon);

// Apply coupon to order
router.post('/:couponId/apply', couponController.applyCoupon);

export default router;
