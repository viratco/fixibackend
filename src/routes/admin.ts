import { Router } from 'express';
import { getUsers, getBookings, getWorkers, addWorker, getServices, updateService } from '../controllers/adminController';

const router = Router();

// For a real production app we'd secure this with an admin auth middleware
// export const adminAuth = (req, res, next) => ...

router.get('/users', getUsers);
router.get('/bookings', getBookings);
router.get('/workers', getWorkers);
router.post('/workers', addWorker);
router.get('/services', getServices);
router.patch('/services/:id', updateService);

export default router;
