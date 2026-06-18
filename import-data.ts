import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // Lê o arquivo JSON com o seu backup de dados
  const rawData = fs.readFileSync('backup-copa.json', 'utf-8');
  const { teams, matches } = JSON.parse(rawData);

  console.log('🚀 Iniciando importação para a nuvem...');

  // Injeta as Seleções (usando createMany para ir de uma vez só)
  if (teams.length > 0) {
    await prisma.team.createMany({ data: teams, skipDuplicates: true });
    console.log(`✅ ${teams.length} seleções importadas!`);
  }

  // Injeta as Partidas
  if (matches.length > 0) {
    await prisma.match.createMany({ data: matches, skipDuplicates: true });
    console.log(`✅ ${matches.length} partidas importadas!`);
  }

  console.log('🏁 Importação concluída com sucesso absoluto!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());