import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { JwtPayload } from '../middleware/auth';
import { auth as firebaseAuth } from '../config/firebase';

import { SignOptions } from 'jsonwebtoken';

const signToken = (payload: JwtPayload) =>
    jwt.sign(payload, process.env.JWT_SECRET as string, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'],
    });

// Temporary in-memory store for OTPs (in production, use Redis or a DB table)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// ─── Customer OTP Flow ─────────────────────────────────────────

export async function sendOtp(req: Request, res: Response): Promise<void> {
    try {
        const { phone } = req.body;
        if (!phone || phone.length !== 10) {
            res.status(400).json({ error: 'Valid 10-digit phone number is required' });
            return;
        }

        // Generate a random 4-digit OTP or a fixed one for testing
        // For testing we will just send back the OTP in the response
        // In reality you would integrate Twilio/AWS SNS here
        const otp = phone === '9999999999' ? '9999' : Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

        otpStore.set(phone, { otp, expiresAt });

        // IMPORTANT FOR TESTING: We return the OTP in the API response so the mobile app can auto-fill it
        // Do NOT do this in production
        res.status(200).json({
            message: 'OTP sent successfully',
            testOtp: otp // <--- Remove this in prod
        });
    } catch (err) {
        console.error('sendOtp error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            res.status(400).json({ error: 'Phone and OTP are required' });
            return;
        }

        const record = otpStore.get(phone);
        if (!record || record.expiresAt < Date.now() || record.otp !== otp) {
            res.status(401).json({ error: 'Invalid or expired OTP' });
            return;
        }

        // OTP is valid. Clear it.
        otpStore.delete(phone);

        // Find or create customer
        // We don't have a name yet if it's a new user, so default to 'Customer'
        let user = await prisma.user.findUnique({ where: { phone } });
        let isNewUser = false;

        if (!user) {
            // Need a dummy password since passwordHash is required in our schema
            const dummyPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);
            user = await prisma.user.create({
                data: {
                    phone,
                    name: 'Customer', // We might want them to update their profile later
                    passwordHash: dummyPasswordHash
                }
            });
            isNewUser = true;
        }

        if (!user.isActive) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        const token = signToken({ id: user.id, role: 'user', phone: user.phone });
        const { passwordHash: _, ...safeUser } = user;

        res.json({
            message: isNewUser ? 'Account created via OTP!' : 'Welcome back!',
            user: safeUser,
            token
        });

    } catch (err) {
        console.error('verifyOtp error:', err);
        res.status(500).json({ error: 'OTP verification failed' });
    }
}

export async function firebaseLogin(req: Request, res: Response): Promise<void> {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ error: 'ID Token is required' });
            return;
        }

        // Verify the Firebase ID Token
        const decodedToken = await firebaseAuth.verifyIdToken(idToken);
        const phone = decodedToken.phone_number?.replace('+91', ''); // Strip prefix to match DB

        if (!phone) {
            res.status(400).json({ error: 'Invalid token: Phone number not found' });
            return;
        }

        // Find or create customer
        let user = await prisma.user.findUnique({ where: { phone } });
        let isNewUser = false;

        if (!user) {
            // New user from Firebase
            const dummyPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);
            user = await prisma.user.create({
                data: {
                    phone,
                    name: 'Customer',
                    passwordHash: dummyPasswordHash
                }
            });
            isNewUser = true;
        }

        if (!user.isActive) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        const token = signToken({ id: user.id, role: 'user', phone: user.phone });
        const { passwordHash: _, ...safeUser } = user;

        res.json({
            message: isNewUser ? 'Account created via Firebase!' : 'Welcome back!',
            user: safeUser,
            token
        });

    } catch (err: any) {
        console.error('firebaseLogin error:', err);
        res.status(401).json({ error: 'Invalid or expired Firebase token' });
    }
}


// ─── Customer Register ─────────────────────────────────────────
export async function registerUser(req: Request, res: Response): Promise<void> {
    try {
        const { name, phone, email, password } = req.body;

        if (!name || !phone || !password) {
            res.status(400).json({ error: 'Name, phone and password are required' });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { phone } });
        if (existing) {
            res.status(409).json({ error: 'Phone number already registered' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, phone, email, passwordHash },
            select: { id: true, name: true, phone: true, email: true, createdAt: true },
        });

        const token = signToken({ id: user.id, role: 'user', phone: user.phone });
        res.status(201).json({ message: 'Account created!', user, token });
    } catch (err) {
        console.error('registerUser error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// ─── Customer Login ────────────────────────────────────────────
export async function loginUser(req: Request, res: Response): Promise<void> {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            res.status(400).json({ error: 'Phone and password are required' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(401).json({ error: 'Invalid phone or password' });
            return;
        }

        if (!user.isActive) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        const token = signToken({ id: user.id, role: 'user', phone: user.phone });
        const { passwordHash: _, ...safeUser } = user;
        res.json({ message: 'Welcome back!', user: safeUser, token });
    } catch (err) {
        console.error('loginUser error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

// ─── Worker Register ───────────────────────────────────────────
export async function registerWorker(req: Request, res: Response): Promise<void> {
    try {
        const { name, phone, email, password, serviceType, city } = req.body;

        if (!name || !phone || !password || !serviceType) {
            res.status(400).json({ error: 'name, phone, password and serviceType are required' });
            return;
        }

        const validTypes = ['nanny', 'japa', 'babysitting', 'cleaning', 'instant'];
        if (!validTypes.includes(serviceType)) {
            res.status(400).json({ error: `serviceType must be one of: ${validTypes.join(', ')}` });
            return;
        }

        const existing = await prisma.worker.findUnique({ where: { phone } });
        if (existing) {
            res.status(409).json({ error: 'Phone number already registered' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const worker = await prisma.worker.create({
            data: { name, phone, email, passwordHash, serviceType, city },
            select: { id: true, name: true, phone: true, serviceType: true, createdAt: true },
        });

        const token = signToken({ id: worker.id, role: 'worker', phone: worker.phone });
        res.status(201).json({ message: 'Worker account created!', worker, token });
    } catch (err) {
        console.error('registerWorker error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// ─── Worker Login ──────────────────────────────────────────────
export async function loginWorker(req: Request, res: Response): Promise<void> {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            res.status(400).json({ error: 'Phone and password are required' });
            return;
        }

        const worker = await prisma.worker.findUnique({ where: { phone } });
        if (!worker || !(await bcrypt.compare(password, worker.passwordHash))) {
            res.status(401).json({ error: 'Invalid phone or password' });
            return;
        }

        if (!worker.isActive) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        const token = signToken({ id: worker.id, role: 'worker', phone: worker.phone });
        const { passwordHash: _, ...safeWorker } = worker;
        res.json({ message: 'Welcome back!', worker: safeWorker, token });
    } catch (err) {
        console.error('loginWorker error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

// ─── Worker OTP Flow (Manual Onboarding) ───────────────────────

export async function sendWorkerOtp(req: Request, res: Response): Promise<void> {
    try {
        const { phone } = req.body;
        if (!phone || phone.length !== 10) {
            res.status(400).json({ error: 'Valid 10-digit phone number is required' });
            return;
        }

        // Only allow OTP if the worker is already registered OR if it's the test number 0000000000
        if (phone !== '0000000000') {
            const worker = await prisma.worker.findUnique({ where: { phone } });
            if (!worker) {
                res.status(404).json({ error: 'Phone number not registered. Please contact Admin for onboarding.' });
                return;
            }
            if (!worker.isActive) {
                res.status(403).json({ error: 'Account is deactivated' });
                return;
            }
        }

        const otp = phone === '0000000000' ? '1234' : Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

        otpStore.set(phone, { otp, expiresAt });

        res.status(200).json({
            message: 'OTP sent successfully',
            testOtp: otp // <--- Remove in prod
        });
    } catch (err) {
        console.error('sendWorkerOtp error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
}

export async function verifyWorkerOtp(req: Request, res: Response): Promise<void> {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            res.status(400).json({ error: 'Phone and OTP are required' });
            return;
        }

        const record = otpStore.get(phone);
        if (!record || record.expiresAt < Date.now() || record.otp !== otp) {
            res.status(401).json({ error: 'Invalid or expired OTP' });
            return;
        }

        // OTP is valid
        otpStore.delete(phone);

        let worker = await prisma.worker.findUnique({ where: { phone } });
        let isNewWorker = false;

        // If it's the test number and doesn't exist yet, create a dummy test worker
        if (!worker && phone === '0000000000') {
            const dummyPasswordHash = await bcrypt.hash('testpass', 10);
            worker = await prisma.worker.create({
                data: {
                    phone: '0000000000',
                    name: 'Test Pro',
                    serviceType: 'cleaning',
                    passwordHash: dummyPasswordHash
                }
            });
            isNewWorker = true;
        }

        if (!worker) {
            res.status(404).json({ error: 'Worker not found' });
            return;
        }

        if (!worker.isActive) {
            res.status(403).json({ error: 'Account is deactivated' });
            return;
        }

        const token = signToken({ id: worker.id, role: 'worker', phone: worker.phone });
        const { passwordHash: _, ...safeWorker } = worker;

        res.json({
            message: isNewWorker ? 'Test worker account created!' : 'Welcome back!',
            worker: safeWorker,
            token
        });

    } catch (err) {
        console.error('verifyWorkerOtp error:', err);
        res.status(500).json({ error: 'OTP verification failed' });
    }
}

