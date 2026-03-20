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

// ─── Privacy Policy ───────────────────────────────────────────
app.get('/privacy', (_req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Privacy Policy | Fixi Services</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
                h1 { color: #007AFF; }
                h2 { margin-top: 30px; }
            </style>
        </head>
        <body>
            <h1>Privacy Policy</h1>
            <p>Last updated: March 20, 2026</p>
            <p>Fixi ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use our mobile applications (Fixi and Fixi Workers) and related services.</p>
            
            <h2>1. Information We Collect</h2>
            <p><strong>Account Information:</strong> Name, phone number, and optional profile details.</p>
            <p><strong>Location Data:</strong> We collect precise location data (GPS) to connect customers with nearby workers and to provide real-time tracking of active bookings. Workers' location is tracked in the background when they are "available" to ensure efficient job matching.</p>
            <p><strong>Service Data:</strong> Details about the services you book or provide, including dates, times, and addresses.</p>

            <h2>2. How We Use Information</h2>
            <p>We use your information to facilitate service bookings, process payments, provide customer support, and improve our services. Location data is specifically used to show workers to customers and vice-versa during active service windows.</p>

            <h2>3. Information Sharing</h2>
            <p>We share necessary information between Customers and Workers (e.g., name, phone number, and location) strictly to facilitate the requested home services. We do not sell your personal data to third parties.</p>

            <h2>4. Your Choices</h2>
            <p>You can manage your profile information and location permissions through your device settings and the app profiles.</p>

            <h2>5. Contact Us</h2>
            <p>If you have questions about this policy, please contact us at support@fixiservices.com</p>
        </body>
        </html>
    `);
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
