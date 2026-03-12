import { recurringQueue } from './redis';

export interface RecurringJobData {
    recurringBookingId: string;
    userId: string;
    serviceId: string;
    address: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    dailyHours: number;
    dayIndex: number;   // 1-based day number (Day 1, Day 2, …)
    scheduledAt: string; // ISO string of when this specific day's job runs
}

/**
 * Enqueues N delayed BullMQ jobs for a recurring booking — one per day.
 * Each job is delayed until its exact scheduled execution time.
 *
 * @returns Array of BullMQ job IDs
 */
export async function scheduleRecurringJobs(
    recurringBookingId: string,
    userId: string,
    serviceId: string,
    startDate: Date,       // First day start datetime (already has correct time of day)
    endDate: Date,         // Last day datetime
    dailyHours: number,
    address: string,
    city?: string,
    latitude?: number,
    longitude?: number,
): Promise<string[]> {
    const jobIds: string[] = [];
    const now = Date.now();

    // Build one job per day from startDate to endDate (inclusive)
    const current = new Date(startDate);
    let dayIndex = 1;

    while (current <= endDate) {
        const scheduledAt = new Date(current);
        const delay = scheduledAt.getTime() - now;

        // Only schedule future jobs (skip days already in the past)
        if (delay > 0) {
            const jobData: RecurringJobData = {
                recurringBookingId,
                userId,
                serviceId,
                address,
                city,
                latitude,
                longitude,
                dailyHours,
                dayIndex,
                scheduledAt: scheduledAt.toISOString(),
            };

            const job = await recurringQueue.add(
                `day-${dayIndex}`,
                jobData,
                {
                    delay,
                    jobId: `recurring-${recurringBookingId}-day-${dayIndex}`,
                }
            );

            jobIds.push(job.id!);
        }

        // Advance to next calendar day, same time
        current.setDate(current.getDate() + 1);
        dayIndex++;
    }

    console.log(
        `📅 Scheduled ${jobIds.length} jobs for RecurringBooking ${recurringBookingId} ` +
        `(${dayIndex - 1} total days, ${dayIndex - 1 - jobIds.length} already past)`
    );

    return jobIds;
}

/**
 * Removes all pending queued jobs for a given recurring booking.
 * Called when the user cancels their subscription.
 */
export async function cancelRecurringJobs(recurringBookingId: string, totalDays: number): Promise<void> {
    const removePromises: Promise<unknown>[] = [];

    for (let i = 1; i <= totalDays; i++) {
        const jobId = `recurring-${recurringBookingId}-day-${i}`;
        removePromises.push(recurringQueue.remove(jobId));
    }

    await Promise.allSettled(removePromises);
    console.log(`🗑️  Removed queued jobs for RecurringBooking ${recurringBookingId}`);
}
