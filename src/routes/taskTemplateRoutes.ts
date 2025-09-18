import express from 'express';
import { taskTemplateController } from '../controllers/taskTemplateController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Task template routes
router.post('/', taskTemplateController.createTemplate);
router.get('/', taskTemplateController.getAllTemplates);
router.get('/categories', taskTemplateController.getTemplateCategories);
router.get('/checklist-type/:checklistType', taskTemplateController.getTemplatesByChecklistType);
router.get('/:id', taskTemplateController.getTemplateById);
router.put('/:id', taskTemplateController.updateTemplate);
router.delete('/:id', taskTemplateController.deleteTemplate);
router.post('/:id/duplicate', taskTemplateController.duplicateTemplate);

export default router;
