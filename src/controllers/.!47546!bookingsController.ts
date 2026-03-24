import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitNewJob, emitJobAccepted, emitJobStatusUpdate } from '../socket';

// In-memory OTP store for booking start/end codes
const bookingOtpStore = new Map<string, { otp: string; type: string; expiresAt: number }>();

