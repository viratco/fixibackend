import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.booking.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { user: true, worker: true }
  });
  console.log('--- LATEST BOOKING DATA ---');
  console.log('Worker Lat:', latest?.worker?.latitude);
  console.log('Worker Lng:', latest?.worker?.longitude);
  console.log('User Lat:', latest?.user?.latitude);
  console.log('User Lng:', latest?.user?.longitude);
}

main().catch(console.error).finally(() => prisma.$disconnect());
