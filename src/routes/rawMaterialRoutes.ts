import express from 'express';
import { rawMaterialController } from '../controllers/rawMaterialController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Raw Material routes
router.get('/', rawMaterialController.getAll);
router.get('/low-stock', rawMaterialController.getLowStock);
router.get('/:id', rawMaterialController.getById);
router.post('/', rawMaterialController.create);
router.put('/:id', rawMaterialController.update);
router.put('/:id/stock', rawMaterialController.updateStock);
router.delete('/:id', rawMaterialController.delete);

export default router;
