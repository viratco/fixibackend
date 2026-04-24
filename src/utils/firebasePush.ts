import * as admin from 'firebase-admin';
import prisma from '../config/prisma';

export async function sendJobAlertToWorkers(serviceId: string, bookingId: string, serviceName: string) {
    try {
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) return;

        // Find available workers for this service type who have FCM tokens
        const workers = await prisma.worker.findMany({
            where: {
                serviceType: service.name,
                isAvailable: true,
                isActive: true,
                fcmToken: { not: null },
            },
            select: { fcmToken: true }
        });

        const tokens = workers.map(w => w.fcmToken).filter(Boolean) as string[];
        if (tokens.length === 0) {
            console.log(`[Push] No available workers with FCM token found for service: ${service.name}`);
            return;
        }

        const message = {
            notification: {
                title: 'New Job Available! 🚨',
                body: `A new ${serviceName} job just came in. Tap to accept it now!`,
            },
            data: {
                bookingId: bookingId,
                type: 'new_job'
            },
            tokens: tokens,
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'new_jobs_channel', // We will create this channel in the frontend
                    sound: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        contentAvailable: true,
                    }
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[Push] Sent job alert to ${response.successCount} workers for booking ${bookingId}`);
    } catch (error) {
        console.error('[Push] Failed to send job alerts:', error);
    }
}
