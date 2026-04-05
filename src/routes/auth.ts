import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as profileController from '../controllers/profileController';
import { authMiddleware } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, authController.registerUser);
router.post('/login', authLimiter, authController.loginUser);
router.post('/otp/send', otpLimiter, authController.sendOtp);
router.post('/otp/verify', authLimiter, authController.verifyOtp);
router.post('/firebase-login', authLimiter, authController.firebaseLogin);

// User profile
router.get('/profile', authMiddleware, profileController.getMyProfile);
router.patch('/profile', authMiddleware, profileController.updateUserProfile);

router.post('/worker/register', authLimiter, authController.registerWorker);
router.post('/worker/login', authLimiter, authController.loginWorker);
router.post('/worker/otp/send', otpLimiter, authController.sendWorkerOtp);
router.post('/worker/otp/verify', authLimiter, authController.verifyWorkerOtp);

export default router;

