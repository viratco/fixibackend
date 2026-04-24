import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating Japa Maid and Babysitting details...');

    const updates = [
        {
            name: 'Japa Maid',
            description: 'Professional post-delivery care for mother and newborn. Our Japa maids are experts in traditional massages and newborn hygiene.',
            included: [
                'Traditional post-delivery massage for mother',
                'Herbal baby massage and bath',
                'Newborn care and feeding support',
                'Sterilizing bottles and baby clothes',
                'Support with mother\'s recovery diet'
            ],
            excluded: [
                'Deep household cleaning',
                'Cooking for the whole family',
                'Grocery shopping or errands',
                'Care for older siblings'
            ]
        },
        {
            name: 'Babysitting',
            description: 'Safe and engaging childcare for your little ones. Our babysitters ensure your children are supervised, fed, and entertained.',
            included: [
                'Creative play and engagement',
                'Supervising meals and snacks',
                'Assistance with homework',
                'Support with bedtime routines',
                'Keeping the nursery/play area tidy'
            ],
            excluded: [
                'Housekeeping or deep cleaning',
                'Cooking meals for adults',
                'Specialized tutoring',
                'Ironing or laundry for parents'
            ]
        }
    ];

    for (const item of updates) {
        const service = await prisma.service.findFirst({ where: { name: item.name } });
        if (service) {
            await prisma.service.update({
                where: { id: service.id },
                data: {
                    description: item.description,
                    included: item.included,
                    excluded: item.excluded
                }
            });
            console.log(`Updated ${item.name}`);
        } else {
            console.warn(`Service ${item.name} not found!`);
        }
    }

    console.log('Update finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
