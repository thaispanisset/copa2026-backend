import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TeamsModule } from './teams/teams.module';
import { MatchesModule } from './matches/matches.module';
import { StandingsModule } from './standings/standings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardUpdatesController } from './dashboard-updates/dashboard-updates.controller';
import { DashboardUpdatesService } from './dashboard-updates/dashboard-updates.service';
import { DashboardUpdatesModule } from './dashboard-updates/dashboard-updates.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/static',
    }),
    PrismaModule,
    TeamsModule,
    MatchesModule,
    StandingsModule,
    NotificationsModule,
    DashboardUpdatesModule,
  ],
  controllers: [AppController, DashboardUpdatesController],
  providers: [AppService, DashboardUpdatesService],
})
export class AppModule {}