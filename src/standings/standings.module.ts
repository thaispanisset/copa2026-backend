import { Module } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { StandingsController } from './standings.controller';

@Module({
  providers: [StandingsService],
  controllers: [StandingsController],
  exports: [StandingsService],
})
export class StandingsModule {}
