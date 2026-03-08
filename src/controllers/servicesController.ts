import { Request, Response } from 'express';
import prisma from '../config/prisma';

// ─── List All Services ─────────────────────────────────────────
export async function getServices(req: Request, res: Response): Promise<void> {
    try {
        const { category } = req.query;

        const services = await prisma.service.findMany({
            where: {
                isActive: true,
                ...(category ? { category: category as string } : {}),
            },
            orderBy: { name: 'asc' },
        });

        res.json({ services });
    } catch (err) {
        console.error('getServices error:', err);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
}

// ─── Get Service By ID ─────────────────────────────────────────
export async function getServiceById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }

        res.json({ service });
    } catch (err) {
        console.error('getServiceById error:', err);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
}
