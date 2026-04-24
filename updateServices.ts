import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany();
  console.log('Current Services:', JSON.stringify(services, null, 2));

  // Find Deep Cleaning and update to Elder Care
  const deepCleaning = await prisma.service.findFirst({
    where: { name: { contains: 'Deep Cleaning', mode: 'insensitive' } }
  });

  if (deepCleaning) {
    await prisma.service.update({
      where: { id: deepCleaning.id },
      data: {
        name: 'Elder Care',
        category: 'Elderly Care',
        description: 'Professional compassionate care for your elders, including medical assistance, companionship, and daily support.',
        iconName: 'heart-outline',
        included: [
          'Vital monitoring',
          'Medicine management',
          'Companionship',
          'Daily activity assistance',
          'Light walking/exercise support'
        ],
        excluded: [
          'Major surgical nursing',
          'Emergency ambulance service',
          'Groceries cost'
        ]
      }
    });
    console.log('Updated Deep Cleaning to Elder Care successfully.');
  } else {
    console.log('Deep Cleaning service not found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
