import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // Busca tudo o que você já cadastrou localmente
  const teams = await prisma.team.findMany();
  const matches = await prisma.match.findMany();

  const backup = { teams, matches };

  // Salva tudo num arquivo de texto JSON
  fs.writeFileSync('backup-copa.json', JSON.stringify(backup, null, 2));
  console.log('✅ Dados exportados com sucesso para o arquivo backup-copa.json!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());