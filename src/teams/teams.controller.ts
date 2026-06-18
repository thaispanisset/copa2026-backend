import { Controller, Post, Get, Body } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { Prisma } from '@prisma/client';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async create(@Body() body: Prisma.TeamCreateInput) {
    return this.teamsService.create(body);
  }

  @Get()
  async findAll() {
    return this.teamsService.findAll();
  }

  @Post('bulk') // Rota: POST /teams/bulk
  async createMany(@Body() body: Prisma.TeamCreateInput[]) {
    return this.teamsService.createMany(body);
  }
}
