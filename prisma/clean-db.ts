/**
 * Clean database: remove all bookings and customer (user) data.
 * Workers and Services are preserved.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning database (keeping workers & services)...');

    // 1. Delete bookings first (cascades to Attendance, Review)
    const bookingsDeleted = await prisma.booking.deleteMany();
    console.log(`   ✓ Deleted ${bookingsDeleted.count} booking(s)`);

    // 2. Delete all customers (users)
    const usersDeleted = await prisma.user.deleteMany();
    console.log(`   ✓ Deleted ${usersDeleted.count} user(s)`);

    console.log('✅ Clean complete. Workers and services preserved.');
}

main()
    .catch((e) => {
        console.error('❌ Clean failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
