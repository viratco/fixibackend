import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    where: {
      name: { in: ['Elder Care', 'Japa Maid', 'Babysitting'] }
    },
    select: { id: true, name: true }
  });
  console.log(JSON.stringify(services, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
