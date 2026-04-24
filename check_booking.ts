import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phone = '8595981183';
  console.log(`Searching for user with phone: ${phone}`);

  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: {
          service: true
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`User found: ${user.name} (ID: ${user.id})`);
  console.log(`Number of bookings: ${user.bookings.length}`);

  user.bookings.forEach((booking) => {
    console.log('---');
    console.log(`ID: ${booking.id}`);
    console.log(`Type: ${booking.bookingType}`);
    console.log(`Status: ${booking.status}`);
    console.log(`Scheduled At: ${booking.scheduledAt}`);
    console.log(`Created At: ${booking.createdAt}`);
    console.log(`Service: ${booking.service.name}`);
    console.log(`Duration: ${booking.durationHours} hrs`);
    console.log(`Total Price: ${booking.totalPrice}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
