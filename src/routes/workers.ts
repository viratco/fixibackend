import { Router } from 'express';
import * as workersController from '../controllers/workersController';
import { workerAuthMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', workersController.getWorkers);
router.get('/profile/me', workerAuthMiddleware, workersController.getMyProfile);
router.patch('/availability', workerAuthMiddleware, workersController.updateAvailability);
router.get('/:id', workersController.getWorkerById);

// Update live location (for active jobs)
router.put('/location', workerAuthMiddleware, workersController.updateLocation);

export default router;
