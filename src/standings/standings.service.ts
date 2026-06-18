import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupStanding, Team } from '@prisma/client';

@Injectable()
export class StandingsService {
  constructor(private prisma: PrismaService) {}

  async initializeStandings() {
    const teams = await this.prisma.team.findMany();

    for (const team of teams) {
      await this.prisma.groupStanding.upsert({
        where: { teamId: team.id },
        update: {},
        create: {
          teamId: team.id,
          groupLetter: team.groupLetter,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalsDifference: 0,
        },
      });
    }

    return { message: 'Tabela de classificação inicializada com sucesso para todos os times!' };
  }

  async getByGroup(groupLetter: string) {
    return this.prisma.groupStanding.findMany({
      where: { groupLetter: groupLetter.toUpperCase() },
      include: { team: true },
      orderBy: [
        { points: 'desc' },
        { goalsDifference: 'desc' },
        { goalsFor: 'desc' },
      ],
    });
  }

  async getTopTwoFromGroup(groupLetter: string) {
    const standings = await this.prisma.groupStanding.findMany({
      where: { groupLetter: groupLetter.toUpperCase() },
      include: { team: true },
      orderBy: [
        { points: 'desc' },
        { goalsDifference: 'desc' },
        { goalsFor: 'desc' },
      ],
      take: 2, // Pega apenas os 2 primeiros colocados!
    });

    return {
      first: standings[0]?.team,
      second: standings[1]?.team,
    };
  }

  async getBestThirdPlaces() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const thirdPlaceTeams: (GroupStanding & { team: Team })[] = [];

    // 1. Percorre todos os 12 grupos para encontrar quem terminou em 3º lugar
    for (const letter of letters) {
      const groupStandings = await this.prisma.groupStanding.findMany({
        where: { groupLetter: letter },
        include: { team: true },
        orderBy: [
          { points: 'desc' },
          { goalsDifference: 'desc' },
          { goalsFor: 'desc' },
        ],
      });

      // Se o grupo já tiver pelo menos 3 times calculados, o índice 2 é o terceiro colocado
      if (groupStandings[2]) {
        thirdPlaceTeams.push(groupStandings[2]);
      }
    }

    // 2. Ordena os terceiros colocados entre si (Ranking Geral dos Terceiros)
    thirdPlaceTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalsDifference !== a.goalsDifference) return b.goalsDifference - a.goalsDifference;
      return b.goalsFor - a.goalsFor;
    });

    // 3. Retorna apenas os 8 melhores times (extraindo o objeto 'team' limpo)
    return thirdPlaceTeams.slice(0, 8).map(standing => standing.team);
  }
}