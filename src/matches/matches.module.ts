import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from '../standings/standings.service';
import { DashboardUpdatesService } from '../dashboard-updates/dashboard-updates.service';
import { DashboardUpdatesModule } from '../dashboard-updates/dashboard-updates.module';

@Module({
  imports: [
    DashboardUpdatesModule
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService, 
    PrismaService, 
    StandingsService,
  ],
  exports: [MatchesService]
})
export class MatchesModule {}