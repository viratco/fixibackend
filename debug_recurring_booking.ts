import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phone = '8595981183';
  console.log(`Searching for user with phone: ${phone}`);

  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      recurringBookings: {
        include: {
          service: true,
          savedAddress: true,
          bookings: {
            orderBy: { scheduledAt: 'desc' },
            take: 10
          }
        }
      },
      bookings: {
        where: { recurringBookingId: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { service: true }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`User found: ${user.name} (ID: ${user.id})`);
  console.log(`Recurring Bookings Count: ${user.recurringBookings.length}`);

  user.recurringBookings.forEach((rb, i) => {
    console.log(`\n--- Recurring Booking #${i + 1} ---`);
    console.log(`ID: ${rb.id}`);
    console.log(`Service: ${rb.service.name}`);
    console.log(`Status: ${rb.status}`);
    console.log(`Address String: "${rb.address}"`);
    console.log(`Address ID: ${rb.addressId}`);
    if (rb.savedAddress) {
      console.log(`Saved Address Details: ${rb.savedAddress.addressLine}, ${rb.savedAddress.label}`);
    } else {
      console.log(`Saved Address: NONE`);
    }
    console.log(`Coordinates: ${rb.latitude}, ${rb.longitude}`);
    console.log(`Generated Bookings: ${rb.bookings.length}`);
    rb.bookings.forEach((b) => {
      console.log(`  - Job Date: ${b.scheduledAt}, Status: ${b.status}, Job Address: "${b.address}"`);
    });
  });

  if (user.bookings.length > 0) {
    console.log(`\n--- One-time Bookings (recent) ---`);
    user.bookings.forEach((b) => {
      console.log(`ID: ${b.id}, Service: ${b.service.name}, Address: "${b.address}"`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
