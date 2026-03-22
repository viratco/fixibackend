import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitNewJob, emitJobAccepted, emitJobStatusUpdate } from '../socket';

// In-memory OTP store for booking start/end codes
const bookingOtpStore = new Map<string, { otp: string; type: string; expiresAt: number }>();

// --- Create Booking ---
export async function createBooking(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        let {
            serviceId,
            bookingType = 'SCHEDULED',
            scheduledAt,
            durationHours,
            address,
            city,
            latitude,
            longitude,
            specialInstructions,
            addressId,          // ← specific Address Book ID from the frontend
        } = req.body;

        bookingType = bookingType.toUpperCase();

        if (!serviceId || !address) {
            res.status(400).json({ error: 'serviceId and address are required' });
            return;
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }

        let totalPrice = 0;
        if (bookingType === 'INSTANT' || bookingType === 'HOURLY' || bookingType === 'SCHEDULED') {
            totalPrice = service.priceHourly * (parseFloat(durationHours as any) || service.minHours || 1);
        }

        // ── Smart Address Resolution ──────────────────────────────────────────────
        // Priority 1: Use the specific addressId the user selected (e.g. "Work").
        // Priority 2: Use the isDefault address if no specific one was passed.
        // Priority 3: Use the raw address string as last resort.
        let finalAddressLine = address;
        let resolvedAddressId: string | undefined = undefined;

        if (addressId) {
            const specificAddress = await prisma.address.findFirst({
                where: { id: addressId, userId }
            });
            if (specificAddress) {
                finalAddressLine = specificAddress.addressLine;
                latitude = specificAddress.latitude;
                longitude = specificAddress.longitude;
                resolvedAddressId = specificAddress.id;
            }
        } else {
            const defaultAddress = await prisma.address.findFirst({
                where: { userId, isDefault: true }
            });
            if (defaultAddress) {
                finalAddressLine = defaultAddress.addressLine;
                if (!latitude) latitude = defaultAddress.latitude;
                if (!longitude) longitude = defaultAddress.longitude;
                resolvedAddressId = defaultAddress.id;
            }
        }

        const booking = await prisma.booking.create({
            data: {
                userId,
                serviceId,
                bookingType: bookingType as any,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : (bookingType === 'INSTANT' || bookingType === 'HOURLY' ? new Date() : undefined),
                durationHours: parseFloat(durationHours) || 0,
                address: finalAddressLine,
                city,
                latitude,
                longitude,
                specialInstructions,
                totalPrice,
                status: 'pending',
                addressId: resolvedAddressId,
            },
            include: {
                service: { select: { name: true, category: true, iconName: true } },
                user: { select: { name: true, phone: true } },
            },
        });

        // ── Emit Real-Time Socket Event ──
        // Only broadcast immediate alerts for Instant/Hourly jobs or those starting within 5 mins
        const isSoon = scheduledAt
            ? (new Date(scheduledAt).getTime() - Date.now()) <= 5 * 60 * 1000
            : true;

        if (bookingType === 'INSTANT' || bookingType === 'HOURLY' || isSoon) {
            emitNewJob(booking);
        }

        res.status(201).json({ message: 'Booking created!', booking });
    } catch (err) {
        console.error('createBooking error details:', err);
        res.status(500).json({ error: 'Failed to create booking. ' + (err instanceof Error ? err.message : '') });
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
                // ── Include the linked Address Book entry for precise coordinates ──
                savedAddress: {
                    select: {
                        id: true, label: true, addressLine: true,
                        landmark: true, latitude: true, longitude: true,
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
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

        const validStatuses = ['on_the_way', 'arrived', 'accepted', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
                worker: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        rating: true,
                        profileImageUrl: true,
                        serviceType: true
                    }
                },
            },
        });

        // If completed, bump worker stats
        if (status === 'completed' && booking.workerId) {
            await prisma.worker.update({
                where: { id: booking.workerId },
                data: { totalJobs: { increment: 1 } },
            });
        }

        // ── Emit Real-Time Socket Events ──
        if (status === 'accepted' && role === 'worker' && updated.worker) {
            emitJobAccepted(updated, updated.worker);
        } else {
            emitJobStatusUpdate(booking.userId, updated.id, status);
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
        const { bookingId: filterId } = req.query;
        const now = new Date();
        const fiveMinsLater = new Date(now.getTime() + 5 * 60 * 1000);

        // 1. Fetch the primary active booking for this worker
        const activeBooking = await prisma.booking.findFirst({
            where: {
                id: filterId ? String(filterId) : undefined,
                workerId,
                status: { in: ['accepted', 'arrived', 'in_progress'] },
            },
            include: {
                service: { select: { name: true, iconName: true, priceHourly: true } },
                user: { select: { name: true, phone: true, address: true, latitude: true, longitude: true, city: true } },
                // ── Include linked Address Book entry ──
                savedAddress: {
                    select: { id: true, label: true, addressLine: true, landmark: true, latitude: true, longitude: true },
                },
            },
            orderBy: { scheduledAt: 'asc' },
        });

        // 2. Fetch pending bookings available for this worker
        const worker = await prisma.worker.findUnique({ where: { id: workerId } });

        // ── City filter: if worker has a city, show their city + cityless jobs.
        // If worker has NO city set, skip city filter entirely → see ALL jobs.
        const cityFilter: any = worker?.city
            ? { OR: [{ city: worker.city }, { city: null }, { city: '' }] }
            : {}; // no worker city → no restriction

        // ── Service filter: broad matching with 'clean' fallback added.
        const serviceFilter: any = worker?.serviceType
            ? {
                OR: [
                    { name: { contains: worker.serviceType, mode: 'insensitive' } },
                    { category: { contains: worker.serviceType.split('_')[0], mode: 'insensitive' } },
                    { category: { contains: 'care', mode: 'insensitive' } },
                    { category: { contains: 'home', mode: 'insensitive' } },
                    { category: { contains: 'clean', mode: 'insensitive' } },
                ]
            }
            : {}; // no serviceType → see all services

        const pending = await prisma.booking.findMany({
            where: {
                status: 'pending',
                workerId: null,
                AND: [
                    cityFilter,
                    {
                        OR: [
                            { bookingType: 'HOURLY' as any },
                            { bookingType: 'INSTANT' as any }, // backwards compat
                            {
                                bookingType: 'SCHEDULED' as any,
                                scheduledAt: { lte: fiveMinsLater }
                            },
                            {
                                bookingType: 'MONTHLY' as any,
                                scheduledAt: { lte: fiveMinsLater }
                            }
                        ]
                    }
                ],
                service: serviceFilter,
            },
            orderBy: { createdAt: 'asc' },
            include: {
                service: { select: { name: true, iconName: true, priceHourly: true, category: true } },
                user: { select: { name: true, phone: true, address: true, city: true, email: true, profileImageUrl: true, latitude: true, longitude: true } },
                // ── Include linked Address Book entry for pending jobs ──
                savedAddress: {
                    select: { id: true, label: true, addressLine: true, landmark: true, latitude: true, longitude: true },
                },
            },
        });

        // ── Debug logging ─────────────────────────────────────────────────
        console.log(`[getWorkerActiveJob] Worker: ${workerId} | city: ${worker?.city} | serviceType: ${worker?.serviceType}`);
        console.log(`[getWorkerActiveJob] Pending jobs found: ${pending.length}`);
        if (pending.length > 0) {
            console.log(`[getWorkerActiveJob] First job: ${pending[0].id} | type: ${pending[0].bookingType} | city: ${pending[0].city}`);
        }

        // ── If worker already has an active job, don't show new jobs ──
        // A busy worker should focus on their current job only.
        if (activeBooking) {
            res.json({ booking: activeBooking, pendingBookings: [] });
            return;
        }

        res.json({ booking: null, pendingBookings: pending });

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

        const booking = await prisma.booking.findFirst({
            where: {
                id,
                workerId
            }
        });

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

// ─── Get Specific Booking for Worker (by ID) ──────────────────────
export async function getWorkerBookingById(req: Request, res: Response): Promise<void> {
    try {
        const workerId = req.user!.id;
        const { id } = req.params;

        const booking = await prisma.booking.findFirst({
            where: {
                id,
                workerId, // must belong to this worker
            },
            include: {
                service: { select: { name: true, iconName: true, priceHourly: true, category: true } },
                user: {
                    select: {
                        name: true,
                        phone: true,
                        address: true,
                        city: true,
                        latitude: true,
                        longitude: true,
                        email: true,
                        profileImageUrl: true,
                    },
                },
            },
        });

        if (!booking) {
            res.status(404).json({ error: 'Booking not found or not assigned to you' });
            return;
        }

        res.json({ booking });
    } catch (err) {
        console.error('getWorkerBookingById error:', err);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
}
