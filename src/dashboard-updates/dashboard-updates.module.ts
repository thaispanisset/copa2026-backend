import { Module } from '@nestjs/common';
import { DashboardUpdatesService } from './dashboard-updates.service';
import { DashboardUpdatesController } from './dashboard-updates.controller';

@Module({
  controllers: [DashboardUpdatesController],
  providers: [DashboardUpdatesService],
  
  exports: [DashboardUpdatesService] 
})
export class DashboardUpdatesModule {}