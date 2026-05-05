import prisma from '../src/config/prisma';

async function main() {
    const services = await prisma.service.findMany({
        select: { id: true, name: true, priceMonthly: true, priceHourly: true }
    });
    console.log(services);
}

main().catch(console.error).finally(() => prisma.$disconnect());
