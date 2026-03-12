import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';

// ─── Singleton io instance ─────────────────────────────────────
let io: SocketIOServer;

export function initSocket(server: http.Server): SocketIOServer {
    io = new SocketIOServer(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        transports: ['websocket', 'polling'],
    });

    // ── Auth middleware on handshake ──────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;
        if (!token) return next(new Error('No token provided'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
            socket.data.userId = decoded.id;
            socket.data.role = decoded.role; // 'user' | 'worker'
            socket.data.city = decoded.city || null;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const { userId, role, city } = socket.data;
        console.log(`[Socket] Connected: ${role} ${userId} | city: ${city}`);

        if (role === 'worker') {
            // Workers join their city room → receive new_job events
            const cityRoom = city ? `city:${city.toLowerCase()}` : 'city:all';
            socket.join(cityRoom);
            socket.join('city:all'); // always join global room for city-less workers
            console.log(`[Socket] Worker ${userId} → joined room "${cityRoom}"`);
        }

        if (role === 'user') {
            // Customers join their own room → receive job_accepted + worker_location
            socket.join(`user:${userId}`);
            console.log(`[Socket] Customer ${userId} → joined room "user:${userId}"`);
        }

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${role} ${userId}`);
        });
    });

    return io;
}

export function getIO(): SocketIOServer {
    if (!io) throw new Error('Socket.io not initialized yet!');
    return io;
}

// ─── Emit helpers ──────────────────────────────────────────────

/**
 * Called when a booking is created.
 * Pushes the job to all workers in the booking's city room.
 */
export function emitNewJob(booking: any) {
    if (!io) return;
    const city = booking.city ? booking.city.toLowerCase() : null;
    const rooms = city ? [`city:${city}`, 'city:all'] : ['city:all'];
    rooms.forEach(room => {
        io.to(room).emit('new_job', {
            bookingId: booking.id,
            bookingType: booking.bookingType,
            serviceName: booking.service?.name,
            serviceIcon: booking.service?.iconName,
            serviceCategory: booking.service?.category,
            address: booking.address,
            city: booking.city,
            totalPrice: booking.totalPrice,
            durationHours: booking.durationHours,
            scheduledAt: booking.scheduledAt,
            customer: {
                name: booking.user?.name,
                phone: booking.user?.phone,
            },
            createdAt: booking.createdAt,
        });
    });
    console.log(`[Socket] Emitted new_job to rooms: ${rooms.join(', ')}`);
}

/**
 * Called when a worker accepts a booking.
 * Pushes to the customer's private room.
 */
export function emitJobAccepted(booking: any, worker: any) {
    if (!io) return;
    io.to(`user:${booking.userId}`).emit('job_accepted', {
        bookingId: booking.id,
        worker: {
            id: worker.id,
            name: worker.name,
            phone: worker.phone,
            serviceType: worker.serviceType,
            profileImageUrl: worker.profileImageUrl,
            rating: worker.rating,
        },
    });
    console.log(`[Socket] Emitted job_accepted to user:${booking.userId}`);
}

/**
 * Called when a worker updates their location.
 * Pushes smooth coordinates to the customer tracking screen.
 */
export function emitWorkerLocation(userId: string, lat: number, lng: number) {
    if (!io) return;
    io.to(`user:${userId}`).emit('worker_location', { latitude: lat, longitude: lng });
}

/**
 * Called on any booking status change (arrived, in_progress, completed).
 * Pushes to the customer's room.
 */
export function emitJobStatusUpdate(userId: string, bookingId: string, status: string) {
    if (!io) return;
    io.to(`user:${userId}`).emit('job_status_update', { bookingId, status });
    console.log(`[Socket] Emitted job_status_update (${status}) to user:${userId}`);
}
