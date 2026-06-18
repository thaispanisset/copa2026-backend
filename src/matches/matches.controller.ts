import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, Sse } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Prisma } from '@prisma/client';
import { DashboardUpdatesService } from '../dashboard-updates/dashboard-updates.service';
import { Observable } from 'rxjs';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly updatesService: DashboardUpdatesService,
  ) {}

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.matchesService.getDashboardStats();
  }

  @Get()
  async findAll() {
    return this.matchesService.findAll();
  }

  @Post()
  async create(@Body() body: Prisma.MatchUncheckedCreateInput) {
    return this.matchesService.create(body);
  }

  @Post('bulk')
  async createMany(@Body() body: Prisma.MatchUncheckedCreateInput[]) {
    return this.matchesService.createMany(body);
  }

  @Patch(':id/finish')
  async finishMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { goalsA: number; goalsB: number },
  ) {
    return this.matchesService.finishMatch(id, body.goalsA, body.goalsB);
  }

  @Post('results-bulk')
  async finishMatchesBulk(@Body() results: any[]) {
    return this.matchesService.finishMatchesBulk(results);
  }

  @Post('generate-brackets') 
  async generateBrackets() {
    return this.matchesService.generateKnockoutTree();
  }

  @Post('fill-thirds')
  async fillThirds() {
    return this.matchesService.fillThirdPlaceSlots();
  }

  @Sse('stats-stream')
  streamDashboardStats(): Observable<any> {
    return this.updatesService.getUpdatesNotification();
  }
}