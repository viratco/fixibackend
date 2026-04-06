import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const phone = '8595981183';
  const existingWorker = await prisma.worker.findUnique({ where: { phone } });
  
  if (existingWorker) {
    console.log('Worker already exists:', existingWorker);
    return;
  }
  
  const passwordHash = await bcrypt.hash('Testpassword123!', 10);
  const newWorker = await prisma.worker.create({
    data: {
      name: 'Test Worker OTP',
      phone: phone,
      passwordHash: passwordHash,
      serviceType: 'Cleaning',
      rating: 5.0,
      totalJobs: 0
    }
  });
  console.log('Worker created successfully:', newWorker);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
