import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

export async function getUsers(req: Request, res: Response) {
    try {
        const users = await prisma.user.findMany({
            include: {
                _count: {
                    select: { bookings: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

export async function getBookings(req: Request, res: Response) {
    try {
        const bookings = await prisma.booking.findMany({
            include: {
                user: { select: { id: true, name: true, phone: true } },
                worker: { select: { id: true, name: true, phone: true } },
                service: { select: { id: true, name: true, basePricePerHour: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
}

export async function getWorkers(req: Request, res: Response) {
    try {
        const workers = await prisma.worker.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(workers);
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
}

export async function addWorker(req: Request, res: Response) {
    try {
        const { phone, name, serviceType, religion } = req.body;
        
        if (!phone || !name || !serviceType) {
            res.status(400).json({ error: 'Phone, name, and service type are required' });
            return;
        }

        const existingWorker = await prisma.worker.findUnique({ where: { phone } });
        if (existingWorker) {
            res.status(409).json({ error: 'Worker with this phone already exists' });
            return;
        }

        const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
        
        const newWorker = await prisma.worker.create({
            data: {
                phone,
                name,
                serviceType,
                passwordHash,
                religion,
                rating: 5.0, // Default for new pro
                totalJobs: 0
            }
        });
        
        res.json({ message: 'Worker created successfully', worker: newWorker });
    } catch (error) {
        console.error('Error adding worker:', error);
        res.status(500).json({ error: 'Failed to add worker' });
    }
}
