import { Module, forwardRef } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from '../standings/standings.service';
import { DashboardUpdatesModule } from '../dashboard-updates/dashboard-updates.module';
import { NotificationsModule } from '../notifications/notifications.module'; // 🟢 1. Importação adicionada

@Module({
  imports: [
    DashboardUpdatesModule,
    forwardRef(() => NotificationsModule) // 🟢 ENVOLVA O MÓDULO AQUI
  ],
  controllers: [MatchesController],
  providers: [MatchesService, PrismaService, StandingsService],
  exports: [MatchesService]
})
export class MatchesModule {}