import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { scheduleRecurringJobs, cancelRecurringJobs } from '../queue/scheduler';

// ─── Create Recurring Booking ────────────────────────────────────
export async function createRecurringBooking(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const {
            serviceId,
            monthsCount,
            startDate,     // ISO string: the first day + time  (e.g. "2026-03-20T10:00:00+05:30")
            startTime,     // Human-readable string for display  (e.g. "10:00 AM")
            dailyHours = 4,
            address,
            city,
            latitude,
            longitude,
        } = req.body;

        if (!serviceId || !monthsCount || !startDate || !address || !startTime) {
            res.status(400).json({ error: 'serviceId, monthsCount, startDate, startTime, and address are required' });
            return;
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }

        // ── Compute date range ────────────────────────────────────────
        const start = new Date(startDate);
        const end = new Date(startDate);
        end.setMonth(end.getMonth() + parseInt(monthsCount));
        end.setDate(end.getDate() - 1); // endDate is inclusive last day

        // Total number of days = difference in days (approx monthsCount * 30)
        const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // ── Total price = daily price * number of days ─────────────────
        const dailyPrice = service.priceHourly * parseFloat(String(dailyHours));
        const totalPrice = parseFloat((dailyPrice * totalDays).toFixed(2));

        // ── Create master RecurringBooking ─────────────────────────────
        const recurringBooking = await prisma.recurringBooking.create({
            data: {
                userId,
                serviceId,
                monthsCount: parseInt(monthsCount),
                startDate: start,
                endDate: end,
                dailyHours: parseFloat(String(dailyHours)),
                startTime,
                address,
                city,
                latitude: latitude ? parseFloat(String(latitude)) : undefined,
                longitude: longitude ? parseFloat(String(longitude)) : undefined,
                totalPrice,
                status: 'active',
            },
            include: {
                service: { select: { name: true, iconName: true } },
                user: { select: { name: true, phone: true } },
            },
        });

        // ── Enqueue all daily jobs ─────────────────────────────────────
        const jobIds = await scheduleRecurringJobs(
            recurringBooking.id,
            userId,
            serviceId,
            start,
            end,
            parseFloat(String(dailyHours)),
            address,
            city,
            latitude ? parseFloat(String(latitude)) : undefined,
            longitude ? parseFloat(String(longitude)) : undefined,
        );

        res.status(201).json({
            message: `Monthly booking created! ${jobIds.length} daily jobs scheduled.`,
            recurringBooking,
            scheduledJobs: jobIds.length,
            totalDays,
        });
    } catch (err) {
        console.error('createRecurringBooking error:', err);
        res.status(500).json({ error: 'Failed to create recurring booking. ' + (err instanceof Error ? err.message : '') });
    }
}

// ─── Get My Recurring Bookings ───────────────────────────────────
export async function getMyRecurringBookings(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;

        const recurringBookings = await prisma.recurringBooking.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                service: { select: { name: true, iconName: true, category: true } },
                bookings: {
                    select: {
                        id: true, status: true, scheduledAt: true, totalPrice: true,
                        worker: { select: { name: true, rating: true } },
                    },
                    orderBy: { scheduledAt: 'asc' },
                },
            },
        });

        res.json({ recurringBookings });
    } catch (err) {
        console.error('getMyRecurringBookings error:', err);
        res.status(500).json({ error: 'Failed to fetch recurring bookings' });
    }
}

// ─── Get Single Recurring Booking ───────────────────────────────
export async function getRecurringBookingById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const recurringBooking = await prisma.recurringBooking.findFirst({
            where: { id, userId },
            include: {
                service: { select: { name: true, iconName: true, category: true, priceHourly: true } },
                bookings: {
                    select: {
                        id: true, status: true, scheduledAt: true, totalPrice: true,
                        worker: { select: { name: true, rating: true, phone: true } },
                    },
                    orderBy: { scheduledAt: 'asc' },
                },
            },
        });

        if (!recurringBooking) {
            res.status(404).json({ error: 'Recurring booking not found' });
            return;
        }

        res.json({ recurringBooking });
    } catch (err) {
        console.error('getRecurringBookingById error:', err);
        res.status(500).json({ error: 'Failed to fetch recurring booking' });
    }
}

// ─── Cancel Recurring Booking ────────────────────────────────────
export async function cancelRecurringBooking(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const recurringBooking = await prisma.recurringBooking.findFirst({ where: { id, userId } });
        if (!recurringBooking) {
            res.status(404).json({ error: 'Recurring booking not found' });
            return;
        }

        if (recurringBooking.status === 'cancelled') {
            res.status(400).json({ error: 'Recurring booking is already cancelled' });
            return;
        }

        // ── Cancel in DB ───────────────────────────────────────────────
        await prisma.recurringBooking.update({
            where: { id },
            data: { status: 'cancelled' },
        });

        // ── Remove pending queue jobs ──────────────────────────────────
        const totalDays = Math.round(
            (recurringBooking.endDate.getTime() - recurringBooking.startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        await cancelRecurringJobs(id, totalDays);

        // ── Cancel any in-flight daily bookings that are still pending ─
        await prisma.booking.updateMany({
            where: { recurringBookingId: id, status: 'pending' },
            data: { status: 'cancelled', cancellationReason: 'Subscription cancelled by user' },
        });

        res.json({ message: 'Recurring booking cancelled. All future jobs removed.' });
    } catch (err) {
        console.error('cancelRecurringBooking error:', err);
        res.status(500).json({ error: 'Failed to cancel recurring booking' });
    }
}
