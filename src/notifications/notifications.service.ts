import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getLiveNotifications() {
    const now = new Date();
    const nowTime = now.getTime(); // Timestamp absoluto de agora

    // Busca todos os jogos com os times inclusos
    const allMatches = await this.prisma.match.findMany({
      include: { teamA: true, teamB: true }
    });

    const notifications: any[] = [];
    let pendingScoresCount = 0;
    const pendingMatchesList: any[] = [];
    
    let semiFinalsReady = false;
    let finalReady = false;

    const MATCH_DURATION_MS = 120 * 60 * 1000;

    allMatches.forEach(m => {
      if (!m.matchDate) return;

      // 🟢 1. Captura o horário real do jogo ignorando fusos externos
      const dbDate = new Date(m.matchDate);
      const matchHours = dbDate.getUTCHours(); // Pega a hora exata salva
      const matchMinutes = dbDate.getUTCMinutes(); // Pega o minuto exato salvo

      // Converte tudo para minutos totais do dia para matar o erro de fuso
      const matchStartMinutes = (matchHours * 60) + matchMinutes;
      const matchEndMinutes = matchStartMinutes + 120; // Janela de 2h de jogo
      
      const currentMinutes = (now.getHours() * 60) + now.getMinutes();

      // Verifica se o jogo é estritamente hoje (Dia e Mês)
      const isToday = dbDate.getUTCDate() === now.getDate() && 
                      (dbDate.getUTCMonth() + 1) === (now.getMonth() + 1);

      // Guarda se a fase atual possui confrontos reais definidos
      if (m.status === 'SCHEDULED' && m.teamAId && m.teamBId) {
        if (m.phase === 'SEMI_FINALS') semiFinalsReady = true;
        if (m.phase === 'FINAL') finalReady = true;
      }

      // ====================================================================
      // ⏳ 1. REGRA: PRE-MATCH (30 MINUTOS ANTES)
      // ====================================================================
      if (m.status === 'SCHEDULED' && m.teamAId && m.teamBId && isToday) {
        const minutesUntilMatch = matchStartMinutes - currentMinutes;
        
        if (minutesUntilMatch > 0 && minutesUntilMatch <= 30) {
          notifications.push({
            type: 'PRE_MATCH',
            title: 'Preparar para o jogo! ⏳',
            description: `Falta pouco! ${m.teamA?.name} x ${m.teamB?.name} começa em ${minutesUntilMatch} minutos.`,
            styleClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
            icon: 'bi-clock-history'
          });
        }
      }

      // ====================================================================
      // ⚽ 2. REGRA: JOGO AO VIVO (BOLA ROLANDO AGORA)
      // ====================================================================
      // Só entra em "Ao Vivo" se for hoje e o relógio atual estiver estritamente dentro das 2h de jogo
      const isLiveNow = m.status !== 'FINISHED' && 
                        m.teamAId && m.teamBId && 
                        isToday && 
                        currentMinutes >= matchStartMinutes && 
                        currentMinutes <= matchEndMinutes;

      if (isLiveNow) {
        notifications.push({
          type: 'LIVE',
          title: 'Bola rolando na Copa! ⚽',
          description: `${m.phase === 'GROUP' ? 'Fase de Grupos' : 'Mata-mata'}: ${m.teamA?.name} x ${m.teamB?.name} está em andamento.`,
          styleClass: 'bg-danger-subtle text-danger',
          icon: 'bi-broadcast'
        });
      }

      // ====================================================================
      // ✏️ 3. REGRA: AGUARDANDO PLACAR (O JOGO REALMENTE ACABOU)
      // ====================================================================
      // Só pede placar se for hoje e as 2h de jogo já estouraram completamente, ou se for um dia passado
      const isPastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() > 
                        new Date(dbDate.getUTCFullYear(), dbDate.getUTCMonth(), dbDate.getUTCDate()).getTime();

      const isTimeOver = m.status === 'SCHEDULED' && 
                         m.teamAId !== null &&
                         (m.goalsA === null || m.goalsB === null) &&
                         (isPastDay || (isToday && currentMinutes > matchEndMinutes));

      if (isTimeOver) {
        pendingScoresCount++;
        pendingMatchesList.push(m);
      }
    });

    // 3. RENDERIZAÇÃO DOS PLACARES PENDENTES
    if (pendingScoresCount > 3) {
      notifications.push({
        type: 'CRITICAL_PENDING',
        title: 'Atenção: Placar Pendente ⚠️',
        description: `Existem ${pendingScoresCount} jogos concluídos aguardando a inserção dos resultados.`,
        styleClass: 'bg-warning-subtle text-warning',
        icon: 'bi-exclamation-triangle-fill'
      });
    } else {
      pendingMatchesList.forEach(m => {
        notifications.push({
          type: 'PENDING',
          phase: m.phase,
          title: 'Inserir placar final ✏️',
          description: `O tempo de ${m.teamA?.name} x ${m.teamB?.name} encerrou. Atualize o sistema.`,
          styleClass: 'bg-light text-secondary',
          icon: 'bi-pencil-square'
        });
      });
    }

    // ====================================================================
    // 💥 4. REGRA: MONITORAMENTO DAS FASES CRÍTICAS (Apenas se os times existirem)
    // ====================================================================
    if (finalReady) {
      notifications.push({
        type: 'PHASE_ALERT',
        title: 'O grande dia chegou! 🏆',
        description: 'A Grande Final está definida no painel. Prepare-se para consagrar o campeão!',
        styleClass: 'bg-dark text-white',
        icon: 'bi-stars'
      });
    } else if (semiFinalsReady) {
      notifications.push({
        type: 'PHASE_ALERT',
        title: 'Coração na boca! 💥',
        description: 'As Semifinais da Copa estão prontas. Os confrontos de alto nível começam logo mais.',
        styleClass: 'bg-info-subtle text-info',
        icon: 'bi-trophy-fill'
      });
    }

    return notifications;
  }
}