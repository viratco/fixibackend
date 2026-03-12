import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitWorkerLocation } from '../socket';

// ─── List Workers ──────────────────────────────────────────────
export async function getWorkers(req: Request, res: Response): Promise<void> {
    try {
        const { serviceType, city, available } = req.query;

        const workers = await prisma.worker.findMany({
            where: {
                isActive: true,
                isVerified: true,
                ...(serviceType ? { serviceType: serviceType as string } : {}),
                ...(city ? { city: { contains: city as string, mode: 'insensitive' } } : {}),
                ...(available !== undefined ? { isAvailable: available === 'true' } : {}),
            },
            select: {
                id: true,
                name: true,
                serviceType: true,
                rating: true,
                totalReviews: true,
                totalJobs: true,
                experienceYears: true,
                city: true,
                isAvailable: true,
                profileImageUrl: true,
                kycVerified: true,
                backgroundChecked: true,
            },
            orderBy: { rating: 'desc' },
        });

        res.json({ workers });
    } catch (err) {
        console.error('getWorkers error:', err);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
}

// ─── Get Worker By ID ──────────────────────────────────────────
export async function getWorkerById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const worker = await prisma.worker.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                serviceType: true,
                bio: true,
                rating: true,
                totalReviews: true,
                totalJobs: true,
                experienceYears: true,
                city: true,
                isAvailable: true,
                profileImageUrl: true,
                kycVerified: true,
                backgroundChecked: true,
                createdAt: true,
                reviews: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        rating: true,
                        comment: true,
                        createdAt: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        if (!worker) {
            res.status(404).json({ error: 'Worker not found' });
            return;
        }

        res.json({ worker });
    } catch (err) {
        console.error('getWorkerById error:', err);
        res.status(500).json({ error: 'Failed to fetch worker' });
    }
}

// ─── Toggle Availability ───────────────────────────────────────
export async function updateAvailability(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;
        const { isAvailable } = req.body;

        if (typeof isAvailable !== 'boolean') {
            res.status(400).json({ error: 'isAvailable must be a boolean' });
            return;
        }

        const worker = await prisma.worker.update({
            where: { id: workerId },
            data: { isAvailable },
            select: { id: true, name: true, isAvailable: true },
        });

        res.json({ message: `You are now ${isAvailable ? 'online' : 'offline'}`, worker });
    } catch (err) {
        console.error('updateAvailability error:', err);
        res.status(500).json({ error: 'Failed to update availability' });
    }
}

// ─── Get My Profile (Worker) ───────────────────────────────────
export async function getMyProfile(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;

        const worker = await prisma.worker.findUnique({
            where: { id: workerId },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                serviceType: true,
                bio: true,
                rating: true,
                totalReviews: true,
                totalJobs: true,
                experienceYears: true,
                city: true,
                isAvailable: true,
                profileImageUrl: true,
                kycVerified: true,
                backgroundChecked: true,
                createdAt: true,
            },
        });

        if (!worker) {
            res.status(404).json({ error: 'Worker not found' });
            return;
        }

        res.json({ worker });
    } catch (err) {
        console.error('getMyProfile error:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
}

// ─── Update Worker Live Location ───────────────────────────────
export async function updateLocation(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            res.status(400).json({ error: 'latitude and longitude are required' });
            return;
        }

        const worker = await prisma.worker.update({
            where: { id: workerId },
            data: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            select: { id: true, latitude: true, longitude: true },
        });

        // ── Emit Real-Time Location to Customer ──
        const activeBooking = await prisma.booking.findFirst({
            where: {
                workerId,
                status: { in: ['accepted', 'on_the_way', 'arrived', 'in_progress'] },
            },
            select: { userId: true },
        });

        if (activeBooking && worker.latitude && worker.longitude) {
            emitWorkerLocation(activeBooking.userId, worker.latitude, worker.longitude);
        }

        res.json({ message: 'Location updated', worker });
    } catch (err) {
        console.error('updateLocation error:', err);
        res.status(500).json({ error: 'Failed to update location' });
    }
}
