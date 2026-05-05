import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const updates = [
    { id: 'c1dfe22d-ef26-4d83-8125-4cf321c82365', priceMonthly: 49000 },
    { id: '424b356f-27e6-4e99-a4b3-a19cf9b70a23', priceMonthly: 25000 },
    { id: 'd2791917-125d-409a-a197-15b6fb5df7d7', priceMonthly: 18000 },
  ];

  for (const update of updates) {
    await prisma.service.update({
      where: { id: update.id },
      data: { priceMonthly: update.priceMonthly },
    });
    console.log(`Updated pricing for service ID ${update.id} to ₹${update.priceMonthly}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
