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
            addressId,
            targetAge,
            religionPreference,
        } = req.body;

        if (!serviceId || !monthsCount || !startDate || !startTime) {
            res.status(400).json({ error: 'serviceId, monthsCount, startDate, and startTime are required' });
            return;
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }

        // ── Compute date range ────────────────────────────────────────
        // Use the actual time the customer selected, but OVERRIDE the date to TODAY for testing
        // This overrides the frontend's 3-day buffer without needing frontend changes
        const start = new Date(startDate);
        const now = new Date();
        start.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
        
        const end = new Date(start);
        end.setMonth(end.getMonth() + parseInt(monthsCount));
        end.setDate(end.getDate() - 1); // endDate is inclusive last day

        // Total number of days = difference in days (approx monthsCount * 30)
        const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // ── Total price calculation ──────────────────────────────────
        // 1. Check if the service has a fixed monthly price
        // 2. If not, fallback to daily price * number of days
        let totalPrice = 0;
        if (service.priceMonthly && service.priceMonthly > 0) {
            // Use fixed monthly price (pro-rated by monthsCount)
            totalPrice = service.priceMonthly * parseInt(monthsCount);
        } else {
            const hourlyRate = service.priceHourly || (service as any).basePricePerHour || 0;
            const dailyPrice = hourlyRate * parseFloat(String(dailyHours));
            totalPrice = parseFloat((dailyPrice * totalDays).toFixed(2));
        }

        // ── Smart Address Resolution (3-level fallback) ───────────────────────────
        // Level 0: Sanitize — treat literal "undefined" / "null" strings as missing
        const isInvalid = (v: any) => !v || v === 'undefined' || v === 'null';

        let finalAddressLine: string | undefined = isInvalid(address) ? undefined : address as string;
        let finalLatitude: number | undefined = (!isInvalid(latitude)) ? parseFloat(latitude as any) : undefined;
        let finalLongitude: number | undefined = (!isInvalid(longitude)) ? parseFloat(longitude as any) : undefined;
        let resolvedAddressId: string | undefined = isInvalid(addressId) ? undefined : addressId as string;

        // Level 1: If an addressId was provided (and not bogus), look it up and fill any gaps
        if (resolvedAddressId) {
            const specificAddress = await prisma.address.findFirst({
                where: { id: resolvedAddressId, userId }
            });
            if (specificAddress) {
                if (!finalAddressLine) finalAddressLine = specificAddress.addressLine + (specificAddress.landmark ? `, ${specificAddress.landmark}` : '');
                if (finalLatitude === undefined) finalLatitude = specificAddress.latitude;
                if (finalLongitude === undefined) finalLongitude = specificAddress.longitude;
            } else {
                resolvedAddressId = undefined; // ID was invalid, clear it
            }
        }

        // Level 2: If address is still missing, fallback to user's default saved address
        if (!finalAddressLine) {
            const defaultAddr = await prisma.address.findFirst({
                where: { userId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (defaultAddr) {
                finalAddressLine = defaultAddr.addressLine + (defaultAddr.landmark ? `, ${defaultAddr.landmark}` : '');
                if (finalLatitude === undefined) finalLatitude = defaultAddr.latitude;
                if (finalLongitude === undefined) finalLongitude = defaultAddr.longitude;
                resolvedAddressId = defaultAddr.id;
            }
        }

        // Level 3: Last resort — use the address from the user's profile
        if (!finalAddressLine) {
            const userProfile = await prisma.user.findUnique({ where: { id: userId } });
            if (userProfile?.address) {
                finalAddressLine = userProfile.address;
                if (finalLatitude === undefined && userProfile.latitude) finalLatitude = userProfile.latitude;
                if (finalLongitude === undefined && userProfile.longitude) finalLongitude = userProfile.longitude;
            }
        }

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
                address: finalAddressLine ?? 'Address not available',
                city,
                latitude: finalLatitude,
                longitude: finalLongitude,
                addressId: resolvedAddressId,
                targetAge,
                religionPreference,
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
            finalAddressLine ?? 'Address not available',
            city,
            finalLatitude,
            finalLongitude,
            resolvedAddressId,
        );

        res.status(201).json({
            message: `Monthly booking created! ${jobIds.length} daily jobs scheduled.`,
            recurringBookingId: recurringBooking.id,
            scheduledJobs: jobIds.length,
            totalDays,
            startDate: start.toISOString(),
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
                service: { select: { name: true, iconName: true, category: true, priceMonthly: true, basePricePerHour: true } },
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
                service: { select: { name: true, iconName: true, category: true, priceHourly: true, priceMonthly: true, basePricePerHour: true } },
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
