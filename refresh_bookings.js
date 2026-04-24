const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- REFRESHING BOOKING DATA ---');
  try {
    // 1. Delete Reviews (linked to Bookings)
    console.log('Deleting Reviews...');
    const reviews = await prisma.review.deleteMany({});
    console.log(`Deleted ${reviews.count} reviews.`);

    // 2. Delete Bookings
    console.log('Deleting Bookings...');
    const bookings = await prisma.booking.deleteMany({});
    console.log(`Deleted ${bookings.count} bookings.`);

    // 3. Delete Recurring Bookings
    console.log('Deleting Recurring Bookings...');
    const recurring = await prisma.recurringBooking.deleteMany({});
    console.log(`Deleted ${recurring.count} recurring bookings.`);

    // 4. Optional: Reset worker totalJobs to 0 (optional but cleaner for re-testing)
    console.log('Resetting worker job counts...');
    await prisma.worker.updateMany({
      data: { totalJobs: 0 }
    });
    console.log('Worker stats reset.');

    console.log('--- REFRESH COMPLETE ---');
  } catch (e) {
    console.error('ERROR during refresh:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
