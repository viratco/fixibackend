const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone = '8595981183';
  console.log('--- RECURRING CHECK ---');
  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        recurringBookings: {
          include: { service: true }
        }
      }
    });

    if (!user) {
      console.log('RESULT: USER_NOT_FOUND');
      return;
    }

    console.log(`RESULT: USER_FOUND: ${user.name}`);
    user.recurringBookings.forEach(rb => {
      console.log(`RECURRING: ID=${rb.id} STATUS=${rb.status} START=${rb.startDate} END=${rb.endDate} DAILY_HRS=${rb.dailyHours} SERVICE=${rb.service.name}`);
    });
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
