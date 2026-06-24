const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.eventConfig.findMany();
  console.log('EventConfigs:', configs);
  
  const sessions = await prisma.session.findMany({
    orderBy: { startTime: 'desc' },
    take: 5
  });
  console.log('Latest 5 Sessions:', sessions);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
