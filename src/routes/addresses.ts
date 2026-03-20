import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth'; 

const router = Router();
const prisma = new PrismaClient();

// Get all addresses for the logged-in user
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, addresses });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
    }
});

// Create a new address
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const { label, addressLine, landmark, latitude, longitude, isDefault } = req.body;

        // If this is set as default, unset others first
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId: req.user.id },
                data: { isDefault: false },
            });
        }

        const newAddress = await prisma.address.create({
            data: {
                userId: req.user.id,
                label,
                addressLine,
                landmark,
                latitude,
                longitude,
                isDefault: isDefault || false,
            },
        });

        // Optionally, update the user's primary location if it's default
        if (isDefault) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: {
                    address: addressLine,
                    latitude,
                    longitude,
                }
            });
        }

        res.status(201).json({ success: true, address: newAddress });
    } catch (error) {
        console.error('Error creating address:', error);
        res.status(500).json({ success: false, error: 'Failed to create address' });
    }
});

// Delete an address
router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        
        // Ensure the address belongs to the user
        const address = await prisma.address.findUnique({ where: { id } });
        if (!address || address.userId !== req.user.id) {
            return res.status(404).json({ success: false, error: 'Address not found' });
        }

        await prisma.address.delete({ where: { id } });
        res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, error: 'Failed to delete address' });
    }
});

export default router;
