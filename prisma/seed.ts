import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Cleaning old services...');
    await prisma.booking.deleteMany();
    await prisma.service.deleteMany();

    console.log('🌱 Seeding database...');

    // Seed Services
    const services = [
        {
            name: 'Nanny',
            category: 'signature_care',
            description: 'We provide experienced and caring nannies to look after your little ones. Verified professionals who ensure safety and playful learning.',
            basePricePerHour: 299.0, // Legacy support
            priceHourly: 299.0,
            priceMonthly: 15000.0,
            minHours: 4,
            iconName: 'baby-face-outline',
            included: [
                'Child supervision & engagement',
                'Feeding and meal prep for children',
                'Maintaining children\'s hygiene',
                'Organizing play areas',
                'Light baby-related laundry',
            ],
            excluded: [
                'General house cleaning',
                'Cooking for adults',
                'Pet care or dog walking',
                'Heavy lifting or chores',
            ],
        },
        {
            name: 'Japa Maid',
            category: 'signature_care',
            description: 'Traditional postnatal care for mother and newborn. Expert massage, bathing, and nutritional support for recovery.',
            basePricePerHour: 499.0,
            priceHourly: 499.0,
            priceMonthly: 20000.0,
            minHours: 8,
            iconName: 'mother-heart',
            included: [
                'Newborn oil massage & bathing',
                'Mother\'s postnatal massage',
                'Lactation support & guidance',
                'Preparing mother\'s special meals',
                'Sterilizing bottles and baby gear',
            ],
            excluded: [
                'General family cooking',
                'Regular house cleaning',
                'Administering medical treatments',
                'Running outside errands',
            ],
        },
        {
            name: 'Babysitting',
            category: 'signature_care',
            description: 'On-demand babysitting for date nights or busy days. Trusted sitters who engage children in fun and safe activities.',
            basePricePerHour: 500.0,
            priceHourly: 500.0,
            priceMonthly: 12000.0,
            minHours: 2,
            iconName: 'human-male-child',
            included: [
                'Temporary child supervision',
                'Engaging in fun activities',
                'Assistance with meals/snacks',
                'Bedtime routines (if applicable)',
            ],
            excluded: [
                'Deep cleaning of house',
                'Educational tutoring',
                'Transporting children in vehicles',
            ],
        },
        {
            name: 'Deep Cleaning',
            category: 'signature_care',
            description: 'Complete home deep cleaning services. We scrub, sanitize, and shine every corner of your home.',
            basePricePerHour: 1500.0,
            priceHourly: 1500.0,
            priceMonthly: 5000.0,
            minHours: 4,
            iconName: 'broom',
            included: [
                'Dusting shelves and furniture',
                'Wipe counters, tables & decor',
                'Clean window sills/grills',
                'Remove accessible cobwebs',
                'Clean appliance exteriors',
                'Floor mopping and sweeping',
            ],
            excluded: [
                'Dusting ceilings or high areas',
                'Using unstable stools or ladders',
                'No chandeliers or fragile items',
                'No exterior grills/windows',
                'Stain removal or restoration',
            ],
        },
    ];

    for (const service of services) {
        await prisma.service.upsert({
            where: { id: service.name }, // use name as a rough upsert key
            update: {},
            create: service,
        });
    }

    // Seed a demo worker
    const workerHash = await bcrypt.hash('worker123', 10);
    await prisma.worker.upsert({
        where: { phone: '9876543210' },
        update: {},
        create: {
            name: 'Rajesh Kumar',
            phone: '9876543210',
            email: 'rajesh@fixiworker.com',
            passwordHash: workerHash,
            serviceType: 'babysitting',
            city: 'Mumbai',
            isVerified: true,
            kycVerified: true,
            backgroundChecked: true,
            rating: 4.9,
            experienceYears: 3,
        },
    });

    // Seed a demo user
    const userHash = await bcrypt.hash('user123', 10);
    await prisma.user.upsert({
        where: { phone: '9999999999' },
        update: {},
        create: {
            name: 'Demo Customer',
            phone: '9999999999',
            email: 'demo@fixi.com',
            passwordHash: userHash,
            city: 'Mumbai',
        },
    });

    console.log('✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
