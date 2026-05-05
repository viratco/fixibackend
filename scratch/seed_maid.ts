import prisma from '../src/config/prisma';

async function main() {
    const maidService = await prisma.service.create({
        data: {
            name: "Maids",
            category: "cleaning",
            description: "Professional, reliable, and thorough home cleaning service. Our vetted maids ensure your home is spotless, leaving every corner shining and fresh.",
            iconName: "broom",
            priceHourly: 299,
            priceMonthly: 15000,
            basePricePerHour: 299,
            minHours: 1,
            isActive: true,
            included: [
                "Dusting and wiping all accessible surfaces",
                "Sweeping, vacuuming, and mopping floors",
                "Thorough bathroom and kitchen cleaning",
                "Making beds and taking out the trash"
            ],
            excluded: [
                "Deep carpet shampooing",
                "Moving heavy furniture",
                "Exterior window washing",
                "Cleaning biohazards or pest infestations"
            ]
        }
    });
    console.log("Created Maids service:", maidService);
}

main().catch(console.error).finally(() => prisma.$disconnect());
