import express from 'express';
import { discountController } from '../controllers/discountController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes (for calculating applicable discounts)
router.post('/calculate', discountController.calculateApplicableDiscounts);
router.get('/active', discountController.getActiveDiscounts);

// Protected routes (admin only)
router.use(authMiddleware);

router.get('/', discountController.getAllDiscounts);
router.get('/:id', discountController.getDiscountById);
router.post('/', discountController.createDiscount);
router.put('/:id', discountController.updateDiscount);
router.delete('/:id', discountController.deleteDiscount);

export default router;
