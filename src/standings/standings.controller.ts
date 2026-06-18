import { Controller, Post, Get, Param } from '@nestjs/common';
import { StandingsService } from './standings.service';

@Controller('standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Post('init')
  async init() {
    return this.standingsService.initializeStandings();
  }

  @Get('group/:letter')
  async getByGroup(@Param('letter') letter: string) {
    return this.standingsService.getByGroup(letter);
  }
}