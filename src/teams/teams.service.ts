import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  // 1. Método para criar UM time por vez (POST /teams)
  async create(data: Prisma.TeamCreateInput) {
    const teamExists = await this.prisma.team.findUnique({
      where: { name: data.name },
    });

    if (teamExists) {
      throw new ConflictException(`A seleção ${data.name} já está cadastrada.`);
    }

    return this.prisma.team.create({ data });
  }

  // 2. Método para criar VÁRIOS times por vez (POST /teams/bulk)
  async createMany(teamsArray: Prisma.TeamCreateInput[]) {
    if (!teamsArray || teamsArray.length === 0) {
      throw new BadRequestException('O array de seleções não pode estar vazio.');
    }

    // Mapeamos os nomes garantindo que o TypeScript saiba que são strings
    const namesToCheck = teamsArray.map((team) => team.name);

    // Verificamos se algum deles já existe
    const existingTeams = await this.prisma.team.findMany({
      where: {
        name: { in: namesToCheck },
      },
    });

    if (existingTeams.length > 0) {
      const existingNames = existingTeams.map((t) => t.name).join(', ');
      throw new ConflictException(`Algumas seleções já estão cadastradas: ${existingNames}`);
    }

    // No createMany, precisamos passar o tipo exato que o Prisma espera para arrays
    return this.prisma.team.createMany({
      data: teamsArray as Prisma.TeamCreateManyInput[],
    });
  }

  async findAll() {
    return this.prisma.team.findMany({
      orderBy: { groupLetter: 'asc' },
    });
  }
}