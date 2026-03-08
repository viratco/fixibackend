const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Deleting all reviews...');
    await prisma.review.deleteMany({});

    console.log('Deleting all bookings...');
    await prisma.booking.deleteMany({});

    console.log('Deleting all users...');
    await prisma.user.deleteMany({});

    console.log('✅ Database cleared! (Workers and Services have been preserved)');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
