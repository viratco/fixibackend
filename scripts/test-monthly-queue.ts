/**
 * TEST SCRIPT: Simulating Recurring Booking Queue
 * Use this to verify that BullMQ jobs are enqueued correctly and spawn bookings.
 * 
 * To run:
 * npx ts-node scripts/test-monthly-queue.ts
 */

import { Queue } from 'bullmq';
import { redisConnection } from '../src/queue/redis';
import prisma from '../src/config/prisma';

async function testQueue() {
    console.log('🧪 Starting Monthly Queue Test...');

    // 1. Get a test user and service
    const user = await prisma.user.findFirst();
    const service = await prisma.service.findFirst();

    if (!user || !service) {
        console.error('❌ No user or service found in DB. Please register a user first.');
        process.exit(1);
    }

    console.log(`👤 Test User: ${user.name}`);
    console.log(`🛠️ Test Service: ${service.name}`);

    // 2. Clear existing test jobs from Redis (optional)
    const testQueue = new Queue('recurring-bookings', { connection: redisConnection });
    await testQueue.drain();
    console.log('🧹 Drained existing "recurring-bookings" queue.');

    // 3. Create a master RecurringBooking
    // We'll simulate a 3-day subscription with jobs firing every 5 seconds
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2); // 3 days total

    const recurring = await prisma.recurringBooking.create({
        data: {
            userId: user.id,
            serviceId: service.id,
            monthsCount: 1,
            startDate,
            endDate,
            dailyHours: 2,
            startTime: '10:00 AM',
            address: '123 Test Street',
            city: 'Test City',
            totalPrice: 1000,
            status: 'active',
        }
    });

    console.log(`✅ Created RecurringBooking in DB: ${recurring.id}`);

    // 4. Manually enqueue 3 jobs with short delays instead of real days
    const delays = [2000, 7000, 12000]; // 2s, 7s, 12s

    for (let i = 0; i < delays.length; i++) {
        const dayNum = i + 1;
        const scheduledTime = new Date(Date.now() + delays[i]);

        await testQueue.add(
            `test-day-${dayNum}`,
            {
                recurringBookingId: recurring.id,
                userId: user.id,
                serviceId: service.id,
                address: recurring.address,
                dailyHours: recurring.dailyHours,
                dayIndex: dayNum,
                scheduledAt: scheduledTime.toISOString(),
            },
            {
                delay: delays[i],
                jobId: `test-${recurring.id}-day-${dayNum}`
            }
        );
        console.log(`⏰ Enqueued Day ${dayNum} with ${delays[i] / 1000}s delay...`);
    }

    console.log('\n🚀 TEST JOBS QUEUED!');
    console.log('👀 NOW WATCH YOUR BACKEND TERMINAL LOGS.');
    console.log('   The jobs should fire automatically and create real bookings in your "bookings" table.');
    console.log('   Check Prisma Studio or your console output to see them appear.');

    console.log('\n--- Test setup complete. You can close this script with Ctrl+C ---');
    console.log('--- The BullMQ worker (inside your server) will handle the rest. ---\n');
}

testQueue().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
