import { Request, Response } from 'express';
import prisma from '../config/prisma';

// ─── Update User Profile ───────────────────────────────────────
export async function updateUserProfile(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const { name, age, address, homeSize, city, latitude, longitude } = req.body;

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (age !== undefined) updateData.age = parseInt(age, 10);
        if (address !== undefined) updateData.address = address;
        if (homeSize !== undefined) updateData.homeSize = homeSize;
        if (city !== undefined) updateData.city = city;
        if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
        if (longitude !== undefined) updateData.longitude = parseFloat(longitude);

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true, name: true, phone: true, email: true,
                age: true, address: true, homeSize: true, city: true,
                profileImageUrl: true, referralCredits: true,
                latitude: true, longitude: true,
            },
        });

        res.json({ message: 'Profile updated', user: updated });
    } catch (err) {
        console.error('updateUserProfile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}
