import express from 'express';
import * as settingsController from '../controllers/settingsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication and admin role
router.use(authMiddleware);

// Get all settings
router.get('/', settingsController.getAllSettings);

// Get settings by category
router.get('/category/:category', settingsController.getSettingsByCategory);

// Get specific setting by key
router.get('/key/:key', settingsController.getSettingByKey);

// Get pricing configuration
router.get('/pricing', settingsController.getPricingConfig);

// Create or update a setting
router.post('/', settingsController.upsertSetting);

// Update multiple settings
router.put('/multiple', settingsController.updateMultipleSettings);

// Delete a setting
router.delete('/:key', settingsController.deleteSetting);

export default router;
