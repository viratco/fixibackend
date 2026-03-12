import { Worker } from 'bullmq';
import prisma from '../config/prisma';
import { redisConnection } from './redis';
import type { RecurringJobData } from './redis';

/**
 * BullMQ Worker — processes one recurring booking job at a time.
 *
 * When a delayed job fires (e.g., Day 14 of 30), this processor:
 * 1. Fetches the parent RecurringBooking and verifies it is still `active`.
 * 2. Creates a standard Booking of type MONTHLY, linked back to the parent
 *    recurring booking via recurringBookingId.
 * 3. The existing worker polling loop on the worker app picks it up automatically.
 */
export function startRecurringProcessor(): Worker {
    const worker = new Worker<RecurringJobData>(
        'recurring-bookings',
        async (job) => {
            const {
                recurringBookingId,
                userId,
                serviceId,
                address,
                city,
                latitude,
                longitude,
                dailyHours,
                dayIndex,
                scheduledAt,
            } = job.data;

            console.log(`⚡ Processing recurring job: ${recurringBookingId} | Day ${dayIndex} | ${scheduledAt}`);

            // ── Step 1: Verify the subscription is still active ─────────────
            const recurringBooking = await prisma.recurringBooking.findUnique({
                where: { id: recurringBookingId },
            });

            if (!recurringBooking || recurringBooking.status !== 'active') {
                console.log(
                    `⏭️  Skipping day ${dayIndex} — RecurringBooking ${recurringBookingId} is ${recurringBooking?.status ?? 'not found'}`
                );
                return { skipped: true, reason: recurringBooking?.status ?? 'not found' };
            }

            // ── Step 2: Fetch service for price calculation ─────────────────
            const service = await prisma.service.findUnique({ where: { id: serviceId } });
            if (!service) throw new Error(`Service ${serviceId} not found`);

            const totalPrice = service.priceHourly * dailyHours;

            // ── Step 3: Create the day's booking ────────────────────────────
            const booking = await prisma.booking.create({
                data: {
                    userId,
                    serviceId,
                    bookingType: 'MONTHLY',
                    status: 'pending',
                    scheduledAt: new Date(scheduledAt),
                    durationHours: dailyHours,
                    address,
                    city,
                    latitude,
                    longitude,
                    totalPrice,
                    recurringBookingId,
                },
            });

            // Fetch related names for logging
            const [svc, usr] = await Promise.all([
                prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } }),
                prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
            ]);

            console.log(`✅ Created Day ${dayIndex} booking: ${booking.id} (${svc?.name}) for ${usr?.name}`);

            // ── Step 4: Check if this was the last day ───────────────────────
            const endDate = new Date(recurringBooking.endDate);
            const jobDate = new Date(scheduledAt);
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (endDate.getTime() - jobDate.getTime() < oneDayMs) {
                await prisma.recurringBooking.update({
                    where: { id: recurringBookingId },
                    data: { status: 'completed' },
                });
                console.log(`🏁 RecurringBooking ${recurringBookingId} completed (all days spawned)`);
            }

            return { bookingId: booking.id, dayIndex };
        },
        {
            connection: redisConnection,
            concurrency: 10,
        }
    );

    worker.on('completed', (job, result) => {
        if (!result?.skipped) {
            console.log(`✅ Recurring job completed: ${job.id} → Booking ${result?.bookingId}`);
        }
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Recurring job failed: ${job?.id} | Error: ${err.message}`);
    });

    worker.on('error', (err) => {
        console.error('❌ Recurring queue worker error:', err);
    });

    console.log('🔄 Recurring booking queue processor started');
    return worker;
}
