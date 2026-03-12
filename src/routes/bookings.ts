import { Router } from 'express';
import * as bookingsController from '../controllers/bookingsController';
import * as recurringController from '../controllers/recurringBookingsController';
import { authMiddleware, workerAuthMiddleware } from '../middleware/auth';

const router = Router();

// ─── Recurring Bookings (must be defined BEFORE /:id routes) ──────
router.post('/recurring', authMiddleware, recurringController.createRecurringBooking);
router.get('/recurring/my', authMiddleware, recurringController.getMyRecurringBookings);
router.get('/recurring/:id', authMiddleware, recurringController.getRecurringBookingById);
router.delete('/recurring/:id', authMiddleware, recurringController.cancelRecurringBooking);

// ─── Regular Bookings ──────────────────────────────────────────────
// Customer
router.post('/', authMiddleware, bookingsController.createBooking);
router.get('/my', authMiddleware, bookingsController.getMyBookings);
router.get('/:id', authMiddleware, bookingsController.getBookingById);
router.patch('/:id/status', authMiddleware, bookingsController.updateBookingStatus);
router.post('/:id/otp/generate', authMiddleware, bookingsController.generateBookingOtp);

// Worker
router.get('/worker/active', workerAuthMiddleware, bookingsController.getWorkerActiveJob);
router.get('/worker/my', workerAuthMiddleware, bookingsController.getWorkerBookings);
router.get('/worker/:id', workerAuthMiddleware, bookingsController.getWorkerBookingById);
router.post('/:id/otp/verify', workerAuthMiddleware, bookingsController.verifyBookingOtp);

export default router;
