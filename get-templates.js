const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.template.findMany();
  console.log('TEMPLATES IN DATABASE:');
  console.log(JSON.stringify(templates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
