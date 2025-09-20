import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { cashBoxController } from '../controllers/cashBoxController';
import { cashSessionTypeController } from '../controllers/cashSessionTypeController';

const router = Router();


// Cash session types CRUD (admin only)
router.get('/session-types', authMiddleware, cashSessionTypeController.list);
router.post('/session-types', authMiddleware, cashSessionTypeController.create);
router.put('/session-types/:id', authMiddleware, cashSessionTypeController.update);
router.delete('/session-types/:id', authMiddleware, cashSessionTypeController.delete);

// Daily sessions management
router.post('/daily-sessions', authMiddleware, cashBoxController.createDailySessions);

// Session management
router.post('/sessions/:sessionId/close', authMiddleware, cashBoxController.closeSession);
router.put('/sessions/:sessionId', authMiddleware, cashBoxController.updateSession);
router.delete('/sessions/:sessionId', authMiddleware, cashBoxController.deleteSession);

router.get('/sessions', authMiddleware, cashBoxController.listSessions);
router.get('/sessions/:sessionId', authMiddleware, cashBoxController.getSessionDetails);
router.get('/summary', authMiddleware, cashBoxController.summary);

export default router;


