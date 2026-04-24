const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone = '8595981183';
  console.log('--- DB CHECK ---');
  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        bookings: {
          include: { service: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      console.log('RESULT: USER_NOT_FOUND');
      return;
    }

    console.log(`RESULT: USER_FOUND: ${user.name}`);
    user.bookings.forEach(b => {
      console.log(`BOOKING: ID=${b.id} TYPE=${b.bookingType} STATUS=${b.status} CREATED=${b.createdAt.toISOString()} DUR=${b.durationHours} PRICE=${b.totalPrice}`);
    });
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
