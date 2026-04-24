const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FULL CUSTOMER & BOOKING REFRESH ---');
  try {
    // 1. Delete Reviews
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

    // 4. Delete Addresses (linked to Users)
    console.log('Deleting Addresses...');
    const addresses = await prisma.address.deleteMany({});
    console.log(`Deleted ${addresses.count} addresses.`);

    // 5. Delete Users (Customers)
    console.log('Deleting Users (Customers)...');
    const users = await prisma.user.deleteMany({});
    console.log(`Deleted ${users.count} users.`);

    // 6. Reset worker totalJobs to 0
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
