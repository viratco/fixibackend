import { Router } from 'express';
import * as bookingsController from '../controllers/bookingsController';
import { authMiddleware, workerAuthMiddleware } from '../middleware/auth';

const router = Router();

// Customer
router.post('/', authMiddleware, bookingsController.createBooking);
router.get('/my', authMiddleware, bookingsController.getMyBookings);
router.get('/:id', authMiddleware, bookingsController.getBookingById);
router.post('/:id/otp/generate', authMiddleware, bookingsController.generateBookingOtp);

// Worker
router.get('/worker/active', workerAuthMiddleware, bookingsController.getWorkerActiveJob);
router.get('/worker/my', workerAuthMiddleware, bookingsController.getWorkerBookings);
router.post('/:id/otp/verify', workerAuthMiddleware, bookingsController.verifyBookingOtp);

// Both (customer can cancel, worker can accept/arrive/start/complete)
router.patch('/:id/status', authMiddleware, bookingsController.updateBookingStatus);
router.patch('/:id/status/worker', workerAuthMiddleware, bookingsController.updateBookingStatus);

export default router;

