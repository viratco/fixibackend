import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as profileController from '../controllers/profileController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/firebase-login', authController.firebaseLogin);

// User profile
router.get('/profile', authMiddleware, profileController.getMyProfile);
router.patch('/profile', authMiddleware, profileController.updateUserProfile);

router.post('/worker/register', authController.registerWorker);
router.post('/worker/login', authController.loginWorker);
router.post('/worker/otp/send', authController.sendWorkerOtp);
router.post('/worker/otp/verify', authController.verifyWorkerOtp);

export default router;

