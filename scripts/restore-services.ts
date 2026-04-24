import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Restoring Japa Maid and Babysitting...');
    
    const servicesToRestore = [
        { name: 'Japa Maid', category: 'signature_care', iconName: 'baby-carriage', priceHourly: 0, basePricePerHour: 150 },
        { name: 'Babysitting', category: 'signature_care', iconName: 'happy-outline', priceHourly: 0, basePricePerHour: 120 }
    ];

    for (const item of servicesToRestore) {
        const exists = await prisma.service.findFirst({ where: { name: item.name } });
        if (!exists) {
            await prisma.service.create({
                data: {
                    name: item.name,
                    category: item.category,
                    iconName: item.iconName,
                    priceHourly: item.priceHourly,
                    basePricePerHour: item.basePricePerHour,
                    isActive: true,
                    description: `Professional ${item.name} services.`
                }
            });
            console.log(`Restored ${item.name}`);
        } else {
            await prisma.service.update({
                where: { id: exists.id },
                data: { isActive: true }
            });
            console.log(`Updated ${item.name} active status`);
        }
    }

    console.log('Done restoring.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
