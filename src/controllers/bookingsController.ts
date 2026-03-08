import { Request, Response } from 'express';
import prisma from '../config/prisma';

// In-memory OTP store for booking start/end codes
const bookingOtpStore = new Map<string, { otp: string; type: string; expiresAt: number }>();

// ─── Create Booking ────────────────────────────────────────────
export async function createBooking(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const {
            serviceId,
            bookingType = 'scheduled', // 'hourly' | 'days' | 'scheduled'
            scheduledAt,
            durationHours, // for hourly
            daysCount,     // for days
            address,
            city,
            latitude,
            longitude,
            specialInstructions,
        } = req.body;

        if (!serviceId || !address) {
            res.status(400).json({ error: 'serviceId and address are required' });
            return;
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }

        // Calculate dynamic total price based on bookingType
        let totalPrice = 0;
        if (bookingType === 'days') {
            totalPrice = service.priceMonthly * (daysCount || 1);
        } else {
            // hourly or default
            totalPrice = service.priceHourly * (durationHours || service.minHours || 1);
        }

        const booking = await prisma.booking.create({
            data: {
                userId,
                serviceId,
                bookingType,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                durationHours: durationHours || 0,
                address,
                city,
                latitude,
                longitude,
                specialInstructions,
                totalPrice,
                status: 'pending',
            },
            include: {
                service: { select: { name: true, category: true, iconName: true } },
                user: { select: { name: true, phone: true } },
            },
        });

        res.status(201).json({ message: 'Booking created!', booking });
    } catch (err) {
        console.error('createBooking error:', err);
        res.status(500).json({ error: 'Failed to create booking' });
    }
}

// ─── Get My Bookings (Customer) ────────────────────────────────
export async function getMyBookings(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;

        const bookings = await prisma.booking.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                service: { select: { name: true, category: true, iconName: true } },
                worker: { select: { id: true, name: true, phone: true, rating: true, profileImageUrl: true } },
                review: { select: { rating: true, comment: true } },
            },
        });

        res.json({ bookings });
    } catch (err) {
        console.error('getMyBookings error:', err);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
}

// ─── Get Booking By ID ─────────────────────────────────────────
export async function getBookingById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const booking = await prisma.booking.findFirst({
            where: { id, userId },
            include: {
                service: true,
                worker: {
                    select: {
                        id: true, name: true, phone: true, rating: true,
                        profileImageUrl: true, serviceType: true,
                        latitude: true, longitude: true,
                    },
                },
                user: {
                    select: {
                        id: true, name: true, phone: true,
                        latitude: true, longitude: true,
                    },
                },
                review: true,
            },
        });

        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        res.json({ booking });
    } catch (err) {
        console.error('getBookingById error:', err);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
}

// ─── Get Worker's Bookings ─────────────────────────────────────
export async function getWorkerBookings(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;

        const bookings = await prisma.booking.findMany({
            where: { workerId },
            orderBy: { scheduledAt: 'asc' },
            include: {
                service: { select: { name: true, iconName: true } },
                user: { select: { name: true, phone: true, address: true, latitude: true, longitude: true } },
            },
        });

        res.json({ bookings });
    } catch (err) {
        console.error('getWorkerBookings error:', err);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
}

// ─── Update Booking Status ─────────────────────────────────────
export async function updateBookingStatus(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { status, cancellationReason } = req.body;
        const { id: actorId, role } = req.user!;

        const validStatuses = ['arrived', 'accepted', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
            return;
        }

        // Make sure this booking belongs to the actor
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        if (role === 'user' && booking.userId !== actorId) {
            res.status(403).json({ error: 'Forbidden: Not your booking' });
            return;
        }

        // Logic for workers to accept UNASSIGNED jobs or manage their IN-PROGRESS jobs
        if (role === 'worker') {
            const isAcceptingNewJob = booking.status === 'pending' && booking.workerId === null && status === 'accepted';
            const isManagingOwnJob = booking.workerId === actorId;

            if (!isAcceptingNewJob && !isManagingOwnJob) {
                res.status(403).json({ error: 'Forbidden: You cannot modify this booking' });
                return;
            }
        }

        const updateData: Record<string, unknown> = { status };

        // If a worker just accepted the job, assign it to them
        if (role === 'worker' && status === 'accepted' && booking.workerId === null) {
            updateData.workerId = actorId;
        }

        if (status === 'in_progress') updateData.startedAt = new Date();
        if (status === 'completed') updateData.completedAt = new Date();
        if (status === 'cancelled' && cancellationReason) updateData.cancellationReason = cancellationReason;

        // When worker accepts, link them to the booking
        if (status === 'accepted' && role === 'worker') {
            updateData.workerId = actorId;
        }

        const updated = await prisma.booking.update({
            where: { id },
            data: updateData,
            include: {
                service: { select: { name: true } },
                worker: { select: { name: true } },
            },
        });

        // If completed, bump worker stats
        if (status === 'completed' && booking.workerId) {
            await prisma.worker.update({
                where: { id: booking.workerId },
                data: { totalJobs: { increment: 1 } },
            });
        }

        res.json({ message: `Booking ${status}`, booking: updated });
    } catch (err) {
        console.error('updateBookingStatus error:', err);
        res.status(500).json({ error: 'Failed to update booking' });
    }
}

// ─── Get Worker's Active Job ───────────────────────────────────
export async function getWorkerActiveJob(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;

        const booking = await prisma.booking.findFirst({
            where: {
                workerId,
                status: { in: ['accepted', 'arrived', 'in_progress'] },
            },
            orderBy: { scheduledAt: 'asc' },
            include: {
                service: { select: { name: true, iconName: true, priceHourly: true } },
                user: { select: { name: true, phone: true, address: true, latitude: true, longitude: true } },
            },
        });

        if (!booking) {
            // Also check if there are pending bookings that should be assigned to any worker
            const pending = await prisma.booking.findMany({
                where: { status: 'pending', workerId: null },
                orderBy: { createdAt: 'asc' },
                include: {
                    service: { select: { name: true, iconName: true, priceHourly: true, category: true } },
                    user: { select: { name: true, phone: true, address: true, city: true, email: true, profileImageUrl: true, latitude: true, longitude: true } },
                },
            });
            res.json({ booking: null, pendingBookings: pending });
            return;
        }

        res.json({ booking, pendingBookings: [] });
    } catch (err) {
        console.error('getWorkerActiveJob error:', err);
        res.status(500).json({ error: 'Failed to fetch active job' });
    }
}

// ─── Generate Booking OTP (Customer) ──────────────────────────
export async function generateBookingOtp(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'start' | 'end'
        const userId = req.user!.id;

        if (!['start', 'end'].includes(type)) {
            res.status(400).json({ error: 'type must be "start" or "end"' });
            return;
        }

        const booking = await prisma.booking.findFirst({ where: { id, userId } });
        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        bookingOtpStore.set(`${id}:${type}`, { otp, type, expiresAt });

        res.json({ message: 'OTP generated', otp });
    } catch (err) {
        console.error('generateBookingOtp error:', err);
        res.status(500).json({ error: 'Failed to generate OTP' });
    }
}

// ─── Verify Booking OTP (Worker) ───────────────────────────────
export async function verifyBookingOtp(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { type, otp } = req.body; // type: 'start' | 'end'
        const workerId = req.user!.id;

        if (!['start', 'end'].includes(type) || !otp) {
            res.status(400).json({ error: 'type and otp are required' });
            return;
        }

        const record = bookingOtpStore.get(`${id}:${type}`);
        if (!record || record.expiresAt < Date.now() || record.otp !== otp) {
            res.status(401).json({ error: 'Invalid or expired OTP' });
            return;
        }

        // OTP valid — clear it
        bookingOtpStore.delete(`${id}:${type}`);

        const booking = await prisma.booking.findFirst({ where: { id, workerId } });
        if (!booking) {
            res.status(404).json({ error: 'Booking not found or not assigned to you' });
            return;
        }

        const newStatus = type === 'start' ? 'in_progress' : 'completed';
        const updateData: Record<string, unknown> = { status: newStatus };
        if (type === 'start') updateData.startedAt = new Date();
        if (type === 'end') {
            updateData.completedAt = new Date();
            // Update worker stat
            await prisma.worker.update({
                where: { id: workerId },
                data: { totalJobs: { increment: 1 } },
            });
        }

        const updated = await prisma.booking.update({
            where: { id },
            data: updateData,
            include: {
                service: { select: { name: true } },
                user: { select: { name: true, phone: true } },
            },
        });

        res.json({ message: `Job ${newStatus.replace('_', ' ')}`, booking: updated });
    } catch (err) {
        console.error('verifyBookingOtp error:', err);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
}
