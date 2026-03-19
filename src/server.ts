import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import prisma from './config/prisma';
import { startRecurringProcessor } from './queue/processor';
import { initSocket } from './socket';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import workerRoutes from './routes/workers';
import serviceRoutes from './routes/services';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: '🚀 Fixi API is running',
        timestamp: new Date().toISOString(),
    });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/services', serviceRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
async function start() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected (Prisma + PostgreSQL)');

        // Wrap express in an http.Server so Socket.io can share the port
        const httpServer = http.createServer(app);

        // Attach Socket.io
        initSocket(httpServer);
        console.log('✅ Socket.io attached');

        // ── Start BullMQ recurring booking processor ────────────
        try {
            startRecurringProcessor();
            console.log('✅ Recurring booking queue processor started');
        } catch (queueErr) {
            console.warn('⚠️  Could not start queue processor (Redis unavailable?):', (queueErr as Error).message);
            console.warn('   Monthly recurring bookings will NOT process until Redis is available.');
        }

        httpServer.listen(PORT, () => {
            console.log(`\n🚀 Fixi API running at:`);
            console.log(`   - Local:   http://localhost:${PORT}`);
            console.log(`   - Network: http://13.232.230.132:${PORT}`);
            console.log(`   - Socket:  ws://13.232.230.132:${PORT}`);
            console.log(`   Mode: ${process.env.NODE_ENV ?? 'development'}`);
            console.log(`\n📡 Endpoints:`);
            console.log(`   POST /api/auth/register`);
            console.log(`   POST /api/auth/login`);
            console.log(`   POST /api/auth/worker/register`);
            console.log(`   POST /api/auth/worker/login`);
            console.log(`   GET  /api/services`);
            console.log(`   POST /api/bookings           (instant/scheduled)`);
            console.log(`   POST /api/bookings/recurring (monthly subscription)`);
            console.log(`   GET  /api/bookings/my`);
            console.log(`   GET  /api/bookings/recurring/my`);
            console.log(`   GET  /api/workers`);
        });
    } catch (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }
}

start();
