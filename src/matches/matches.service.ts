import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { StandingsService } from '../standings/standings.service';
import { DashboardUpdatesService } from '../dashboard-updates/dashboard-updates.service';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService, private standingsService: StandingsService, private updatesService: DashboardUpdatesService) {}

  async create(data: Prisma.MatchUncheckedCreateInput) {
    if (data.teamAId === data.teamBId) {
      throw new BadRequestException('O Time A não pode ser igual ao Time B.');
    }
    return this.prisma.match.create({
      data: { ...data, status: data.status || 'SCHEDULED' },
    });
  }

  async createMany(matchesArray: Prisma.MatchUncheckedCreateInput[]) {
    if (!matchesArray || matchesArray.length === 0) {
      throw new BadRequestException('O array de partidas não pode estar vazio.');
    }

    for (const match of matchesArray) {
      if (match.teamAId === match.teamBId) {
        throw new BadRequestException('Um time não pode jogar contra ele mesmo in nenhuma das partidas.');
      }
    }

    const matchesToCreate = matchesArray.map(match => ({
      ...match,
      status: match.status || 'SCHEDULED'
    }));

    return this.prisma.match.createMany({
      data: matchesToCreate as Prisma.MatchCreateManyInput[],
    });
  }

  async finishMatch(matchId: number, goalsA: number, goalsB: number) {
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        goalsA: Number(goalsA),
        goalsB: Number(goalsB),
        status: 'FINISHED',
      },
      include: { teamA: true, teamB: true },
    });

    if (match.teamA?.groupLetter) {
      await this.recalculateGroupStandings(match.teamA.groupLetter);
    }

    return match;
  }

  async finishMatchesBulk(resultsArray: any[]) {
    if (!resultsArray || resultsArray.length === 0) {
      throw new BadRequestException('O array de resultados não pode estar vazio.');
    }

    const groupsToRecalculate = new Set<string>();

    const updatedMatches = await this.prisma.$transaction(
      resultsArray.map((result) => {
        const id = result.matchId ?? result.id;
        if (!id) throw new BadRequestException('Cada registro precisa de um id válido.');

        return this.prisma.match.update({
          where: { id: Number(id) },
          data: {
            goalsA: result.goalsA !== null ? Number(result.goalsA) : null,
            goalsB: result.goalsB !== null ? Number(result.goalsB) : null,
            status: 'FINISHED',
          },
          include: { teamA: true, teamB: true },
        });
      }),
    );

    for (const match of updatedMatches) {
      if (match.teamA?.groupLetter) groupsToRecalculate.add(match.teamA.groupLetter);
      else if (match.teamB?.groupLetter) groupsToRecalculate.add(match.teamB.groupLetter);
    }

    for (const groupLetter of groupsToRecalculate) {
      await this.recalculateGroupStandings(groupLetter);
    }

    const remainingGroupMatches = await this.prisma.match.count({
      where: {
        phase: 'GROUP',
        status: 'SCHEDULED'
      }
    });

    let treeGenerated = false;

    if (remainingGroupMatches === 0) {
      try {
        await this.generateKnockoutTree();
        await this.fillThirdPlaceSlots(); 
        treeGenerated = true;
      } catch (error) {
        console.error('⚠️ Falha ao automatizar o mata-mata:', error.message);
      }
    }

    const freshStats = await this.getDashboardStats();
    this.updatesService.sendUpdate(freshStats);

    return {
      message: `${resultsArray.length} partidas atualizadas e tabelas de classificação recalculadas!`,
      affectedGroups: Array.from(groupsToRecalculate),
      knockoutTreeGenerated: treeGenerated
    };
  }

  private async recalculateGroupStandings(groupLetter: string) {
    const teams = await this.prisma.team.findMany({
      where: { groupLetter },
    });

    const finishedMatches = await this.prisma.match.findMany({
      where: {
        phase: 'GROUP',
        status: 'FINISHED',
        teamA: { groupLetter },
      },
    });

    for (const team of teams) {
      let points = 0;
      let played = 0;
      let won = 0;
      let drawn = 0;
      let lost = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      const teamMatches = finishedMatches.filter(
        (m) => m.teamAId === team.id || m.teamBId === team.id,
      );

      for (const match of teamMatches) {
        played++;

        if (match.teamAId === team.id) {
          goalsFor += match.goalsA ?? 0;
          goalsAgainst += match.goalsB ?? 0;

          if ((match.goalsA ?? 0) > (match.goalsB ?? 0)) {
            points += 3;
            won++;
          } else if (match.goalsA === match.goalsB) {
            points += 1;
            drawn++;
          } else {
            lost++;
          }
        } 
        else {
          goalsFor += match.goalsB ?? 0;
          goalsAgainst += match.goalsA ?? 0;

          if ((match.goalsB ?? 0) > (match.goalsA ?? 0)) {
            points += 3;
            won++;
          } else if (match.goalsA === match.goalsB) {
            points += 1;
            drawn++;
          } else {
            lost++;
          }
        }
      }

      await this.prisma.groupStanding.update({
        where: { teamId: team.id },
        data: {
          points,
          played,
          won,
          drawn,
          lost,
          goalsFor,
          goalsAgainst,
          goalsDifference: goalsFor - goalsAgainst,
        },
      });
    }
  }

  async generateKnockoutTree() {
    await this.prisma.match.deleteMany({
      where: {
        phase: {
          in: ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
        },
        status: 'SCHEDULED'
      }
    });

    const finalMatch = await this.prisma.match.create({
      data: {
        phase: 'FINAL',
        matchDate: new Date('2026-07-19T16:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const thirdPlaceMatch = await this.prisma.match.create({
      data: {
        phase: 'THIRD_PLACE',
        matchDate: new Date('2026-07-18T16:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const semi1 = await this.prisma.match.create({
      data: {
        phase: 'SEMI_FINALS',
        matchDate: new Date('2026-07-14T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: finalMatch.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const semi2 = await this.prisma.match.create({
      data: {
        phase: 'SEMI_FINALS',
        matchDate: new Date('2026-07-15T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: finalMatch.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const qf1 = await this.prisma.match.create({
      data: {
        phase: 'QUARTER_FINALS',
        matchDate: new Date('2026-07-09T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: semi1.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const qf2 = await this.prisma.match.create({
      data: {
        phase: 'QUARTER_FINALS',
        matchDate: new Date('2026-07-10T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: semi1.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const qf3 = await this.prisma.match.create({
      data: {
        phase: 'QUARTER_FINALS',
        matchDate: new Date('2026-07-11T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: semi2.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const qf4 = await this.prisma.match.create({
      data: {
        phase: 'QUARTER_FINALS',
        matchDate: new Date('2026-07-12T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: semi2.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const r16_1 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-04T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf1.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const r16_2 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-04T21:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf1.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const r16_3 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-05T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf2.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const r16_4 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-05T21:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf2.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const r16_5 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-06T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf3.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const r16_6 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-06T21:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf3.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const r16_7 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-07T17:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf4.id,
        nextMatchTeamPlace: 'A',
      },
    });

    const r16_8 = await this.prisma.match.create({
      data: {
        phase: 'ROUND_OF_16',
        matchDate: new Date('2026-07-07T21:00:00Z'),
        status: 'SCHEDULED',
        nextMatchId: qf4.id,
        nextMatchTeamPlace: 'B',
      },
    });

    const grupoA = await this.standingsService.getTopTwoFromGroup('A');
    const grupoB = await this.standingsService.getTopTwoFromGroup('B');
    const grupoC = await this.standingsService.getTopTwoFromGroup('C');
    const grupoD = await this.standingsService.getTopTwoFromGroup('D');
    const grupoE = await this.standingsService.getTopTwoFromGroup('E');
    const grupoF = await this.standingsService.getTopTwoFromGroup('F');
    const grupoG = await this.standingsService.getTopTwoFromGroup('G');
    const grupoH = await this.standingsService.getTopTwoFromGroup('H');
    const grupoI = await this.standingsService.getTopTwoFromGroup('I');
    const grupoJ = await this.standingsService.getTopTwoFromGroup('J');
    const grupoK = await this.standingsService.getTopTwoFromGroup('K');
    const grupoL = await this.standingsService.getTopTwoFromGroup('L');

    if (!grupoA.first || !grupoB.second || !grupoC.first || !grupoD.second || !grupoE.first || !grupoF.second || !grupoG.first || !grupoH.second || !grupoI.first || !grupoJ.second || !grupoK.first || !grupoL.second) {
      throw new BadRequestException('Classificação insuficiente para gerar a árvore.');
    }

    await this.prisma.match.createMany({
      data: [
        { teamAId: grupoA.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-28T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_1.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoB.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-28T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_1.id, nextMatchTeamPlace: 'B' },
        { teamAId: grupoC.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-29T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_2.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoD.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-29T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_2.id, nextMatchTeamPlace: 'B' },
        { teamAId: grupoE.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-30T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_3.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoF.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-06-30T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_3.id, nextMatchTeamPlace: 'B' },
        { teamAId: grupoG.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-01T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_4.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoH.first.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-01T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_4.id, nextMatchTeamPlace: 'B' },

        { teamAId: grupoI.first.id, teamBId: grupoA.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-02T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_5.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoJ.first.id, teamBId: grupoB.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-02T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_5.id, nextMatchTeamPlace: 'B' },
        { teamAId: grupoK.first.id, teamBId: grupoC.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-03T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_6.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoL.first.id, teamBId: grupoD.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-03T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_6.id, nextMatchTeamPlace: 'B' },

        { teamAId: grupoE.second.id, teamBId: grupoF.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-04T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_7.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoG.second.id, teamBId: grupoH.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-04T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_7.id, nextMatchTeamPlace: 'B' },
        { teamAId: grupoI.second.id, teamBId: grupoJ.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-05T18:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_8.id, nextMatchTeamPlace: 'A' },
        { teamAId: grupoK.second.id, teamBId: grupoL.second.id, phase: 'ROUND_OF_32', matchDate: new Date('2026-07-05T21:00:00Z'), status: 'SCHEDULED', nextMatchId: r16_8.id, nextMatchTeamPlace: 'B' }
      ],
    });

    return { message: 'A árvore do mata-mata foi construída do zero, limpando duplicados!' };
  }

  async fillThirdPlaceSlots() {
    const bestThirds = await this.standingsService.getBestThirdPlaces();

    if (bestThirds.length < 8) {
      throw new BadRequestException('Não há dados de terceiros colocados suficientes.');
    }

    const emptyMatches = await this.prisma.match.findMany({
      where: { phase: 'ROUND_OF_32', teamBId: null },
      orderBy: { id: 'asc' },
    });

    if (emptyMatches.length !== 8) {
      throw new BadRequestException(`Foram encontradas ${emptyMatches.length} vagas abertas, mas precisamos de 8.`);
    }

    for (let i = 0; i < 8; i++) {
      await this.prisma.match.update({
        where: { id: emptyMatches[i].id },
        data: { teamBId: bestThirds[i].id },
      });
    }

    return {
      message: 'As chaves foram preenchidas!',
      classificados: bestThirds.map((t) => t.name),
    };
  }

  async findAll() {
    const matches = await this.prisma.match.findMany({
      include: {
        teamA: true,
        teamB: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    // Removemos o offset do fuso horário para que o Angular leia a hora exata do banco
    return matches.map(match => {
      if (match.matchDate) {
        const localISO = new Date(match.matchDate).toISOString().slice(0, 19);
        return {
          ...match,
          matchDate: localISO
        };
      }
      return match;
    });
  }

  async getDashboardStats() {
    const now = new Date();
    const nowTime = now.getTime();
    
    const allMatches = await this.prisma.match.findMany({
      include: { teamA: true, teamB: true }
    });

    const totalMatches = allMatches.length;
    const finishedMatches = allMatches.filter(m => m.status === 'FINISHED').length;
    const remainingMatches = totalMatches - finishedMatches;
    
    let todayMatchesCount = 0;
    let liveMatchesCount = 0;

    const liveMatchesList: any[] = [];
    
    let upcomingMatch: any = null;

    const todayMatchesList: any[] = [];

    allMatches.forEach(m => {
      if (!m.matchDate) return;

      const dbDate = new Date(m.matchDate);
      
      const matchYear = dbDate.getUTCFullYear();
      const matchMonth = dbDate.getUTCMonth();
      const matchDay = dbDate.getUTCDate();
      const matchHours = dbDate.getUTCHours();
      const matchMinutes = dbDate.getUTCMinutes();

      const matchDateObj = new Date(matchYear, matchMonth, matchDay, matchHours, matchMinutes);
      
      const currentMonthDay = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const matchMonthDay = `${String(matchDateObj.getDate()).padStart(2, '0')}-${String(matchDateObj.getMonth() + 1).padStart(2, '0')}`;

      if (matchMonthDay === currentMonthDay) {
        todayMatchesCount++;

        todayMatchesList.push({
          id: m.id,
          hour: `${String(matchHours).padStart(2, '0')}:${String(matchMinutes).padStart(2, '0')}`,
          teamAName: m.teamA?.name || 'A definir',
          teamAFlag: m.teamA?.flagUrl,
          teamBName: m.teamB?.name || 'A definir',
          teamBFlag: m.teamB?.flagUrl,
          status: m.status
        });
      }

      if (m.status === 'SCHEDULED' && m.teamAId && m.teamBId) {
        const matchTime = new Date(m.matchDate).getTime();
        const minutesUntilMatch = Math.ceil((matchTime - nowTime) / (1000 * 60));

        if (minutesUntilMatch > 0 && minutesUntilMatch <= 30) {
          upcomingMatch = {
            teamAName: m.teamA?.name,
            teamAFlag: m.teamA?.flagUrl,
            teamBName: m.teamB?.name,
            teamBFlag: m.teamB?.flagUrl,
            minutesUntilMatch: minutesUntilMatch
          };
        }
      }

      if (m.status !== 'FINISHED') {
        const startMinutes = (matchHours * 60) + matchMinutes;
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        const duration = 150;

        let isLiveNow = false;

        if (matchMonthDay === currentMonthDay) {
          isLiveNow = currentMinutes >= startMinutes && currentMinutes <= (startMinutes + duration);
        } 
        else {
          const ontemDate = new Date(now);
          ontemDate.setDate(now.getDate() - 1);
          const ontemMonthDay = `${String(ontemDate.getDate()).padStart(2, '0')}-${String(ontemDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (matchMonthDay === ontemMonthDay) {
            const endMinutesToday = (startMinutes + duration) - 1440;
            isLiveNow = currentMinutes <= endMinutesToday;
          }
        }

        if (isLiveNow) {
          liveMatchesCount++;
          
          liveMatchesList.push({
            id: m.id,
            teamAName: m.teamA?.name || 'A definir',
            teamAFlag: m.teamA?.flagUrl,
            teamBName: m.teamB?.name || 'A definir',
            teamBFlag: m.teamB?.flagUrl
          });
        }
      } // 👈 Fechamento correto da condicional status !== 'FINISHED'
    }); // 👈 Fechamento correto do forEach geral

    const phaseOrder = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
    let currentPhase = 'CONCLUÍDA';

    for (const phase of phaseOrder) {
      const hasPending = allMatches.some(m => m.phase === phase && m.status === 'SCHEDULED');
      if (hasPending) {
        currentPhase = phase;
        break;
      }
    }

    const pendingInCurrentPhase = allMatches.filter(
      m => m.phase === currentPhase && m.status === 'SCHEDULED'
    ).length;

    const phaseLabels: Record<string, string> = {
      'GROUP': 'Fase de Grupos',
      'ROUND_OF_32': 'Dezesseis-avos de Final',
      'ROUND_OF_16': 'Oitavas de Final',
      'QUARTER_FINALS': 'Quartas de Final',
      'SEMI_FINALS': 'Semifinais',
      'THIRD_PLACE': 'Disputa de 3º Lugar 🥉',
      'FINAL': 'Grande Final',
      'CONCLUÍDA': 'Copa Encerrada 🏆'
    };

    todayMatchesList.sort((a, b) => a.hour.localeCompare(b.hour));
    const formattedTodayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      totalMatches,
      finishedMatches,
      remainingMatches,
      progressPercentage: totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0,
      currentPhase: phaseLabels[currentPhase] || currentPhase,
      pendingInCurrentPhase,
      liveMatchesCount,
      todayMatchesCount,
      liveMatchesList,
      todayMatchesList,
      upcomingMatch,
      formattedTodayDate
    };
  }
}