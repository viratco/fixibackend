import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up old services...');
    // Delete Nanny, Japa Maid, Babysitting
    const toDelete = ['Nanny', 'Japa Maid', 'Babysitting'];
    
    // Check bookings tied to these to see if they prevent deletion
    for (const name of toDelete) {
        const service = await prisma.service.findFirst({ where: { name } });
        if (service) {
             const bookingCount = await prisma.booking.count({ where: { serviceId: service.id } });
             if (bookingCount > 0) {
                 console.log(`Setting ${name} inactive instead of deleting (Bookings exist).`);
                 await prisma.service.update({
                     where: { id: service.id },
                     data: { isActive: false, category: 'legacy' }
                 });
             } else {
                 console.log(`Deleting ${name}...`);
                 await prisma.service.delete({ where: { id: service.id } });
             }
        }
    }

    console.log('Inserting new Coming Soon services...');
    const comingSoonServices = [
        { name: 'Plumbing', iconName: 'water' },
        { name: 'Electrical', iconName: 'flash' },
        { name: 'Carpentry', iconName: 'hammer' },
        { name: 'Painting', iconName: 'color-palette' },
        { name: 'Appliances', iconName: 'construct' }
    ];

    for (const item of comingSoonServices) {
        const exists = await prisma.service.findFirst({ where: { name: item.name } });
        if (!exists) {
            await prisma.service.create({
                data: {
                    name: item.name,
                    category: 'coming_soon',
                    description: `${item.name} services coming soon.`,
                    basePricePerHour: 0.0,
                    priceHourly: 0.0,
                    iconName: item.iconName, // Using standard Ionicons mapped names
                    isActive: true
                }
            });
            console.log(`Created ${item.name}`);
        } else {
            // Update to be sure it's coming_soon
            await prisma.service.update({
                where: { id: exists.id },
                data: { category: 'coming_soon' }
            });
            console.log(`Updated ${item.name}`);
        }
    }
    
    console.log('Migration Complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
