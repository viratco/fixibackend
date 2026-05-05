import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const rb = await prisma.recurringBooking.findFirst({
        include: { service: { select: { name: true, priceMonthly: true, basePricePerHour: true } } }
    });
    console.log(JSON.stringify(rb, null, 2));
}
main();
