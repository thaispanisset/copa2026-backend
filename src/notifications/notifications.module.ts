import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module'; // Ajuste o caminho do seu PrismaModule se necessário

@Module({
  imports: [PrismaModule], // Importa o Prisma para o service conseguir consultar os jogos no banco
  controllers: [NotificationsController], // Registra o Controller que criamos acima
  providers: [NotificationsService], // Registra o Service com a inteligência das regras
})
export class NotificationsModule {}