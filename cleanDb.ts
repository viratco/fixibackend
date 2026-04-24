import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database cleanup...');

  // Delete in order to avoid foreign key constraint violations
  const deletedReviews = await prisma.review.deleteMany({});
  console.log(`Deleted ${deletedReviews.count} reviews.`);

  const deletedBookings = await prisma.booking.deleteMany({});
  console.log(`Deleted ${deletedBookings.count} bookings.`);

  const deletedRecurringBookings = await prisma.recurringBooking.deleteMany({});
  console.log(`Deleted ${deletedRecurringBookings.count} recurring bookings.`);

  const deletedAddresses = await prisma.address.deleteMany({});
  console.log(`Deleted ${deletedAddresses.count} addresses.`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`Deleted ${deletedUsers.count} users (customers).`);

  console.log('Database cleanup complete. Kept Workers and Services!');
}

main()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
