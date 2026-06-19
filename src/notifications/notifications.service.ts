import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';

// 🟢 O SEGREDO: Importação direta e cirúrgica dos submódulos do Firebase
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    try {
      const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
      
      // 🟢 Nova forma modular de inicializar
      initializeApp({
        credential: cert(serviceAccountPath),
      });
      
      console.log('🔥 Firebase Admin SDK inicializado e conectado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao inicializar o Firebase Admin SDK:', error);
    }
  }

  async registerToken(username: string, deviceToken: string) {
    return this.prisma.deviceToken.upsert({
      where: { token: deviceToken },
      update: { username },
      create: {
        username,
        token: deviceToken,
      },
    });
  }

  // 🟢 Método de envio atualizado com o canal padrão de som/alerta do Android
  async sendPushNotification(title: string, body: string) {
    try {
      const devices = await this.prisma.deviceToken.findMany();
      const tokens = devices.map(d => d.token);

      if (tokens.length === 0) {
        console.log('⚠️ Nenhum dispositivo registrado no TiDB para receber push.');
        return;
      }

      const message: MulticastMessage = {
        tokens: tokens,
        notification: { title, body },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#cea760',
            channelId: 'default',
            sound: 'default'
          },
        },
      };

      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`🔔 Push enviado! Sucesso: ${response.successCount} | Falha: ${response.failureCount}`);
    } catch (error) {
      console.error('❌ Erro fatal ao disparar notificações push:', error);
    }
  }

  // 🟢 ADICIONE ESTE MÉTODO LOGO ABAIXO DO sendPushNotification:
  async checkAndSendAutomaticPushes() {
    try {
      // 1. Puxa a lista de notificações gerada pelo seu método do sininho
      const liveAlerts = await this.getLiveNotifications();

      if (liveAlerts.length === 0) return;

      // 2. Filtra se existe alguma notificação urgente do tipo 'LIVE' ou 'PENDING'
      for (const alert of liveAlerts) {
        // Criamos uma chave no banco ou memória rápida para evitar mandar o MESMO push a cada 30 segundos
        // Mas para garantir o disparo de novas notificações:
        if (alert.type === 'LIVE') {
          await this.sendPushNotification(alert.title, alert.description);
        }
        
        if (alert.type === 'CRITICAL_PENDING') {
          await this.sendPushNotification(alert.title, alert.description);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar gatilhos automáticos de push:', error);
    }
  }

  async getLiveNotifications() {
    // 🟢 GARANTE O HORÁRIO DO BRASIL NO RENDER:
    const agoraUtc = new Date();
    const fusoBrasilia = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    
    const parts = fusoBrasilia.formatToParts(agoraUtc);
    const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value);
    
    // Esse objeto 'now' agora tem as propriedades de hora/dia batendo com Brasília
    const now = new Date(getPart('year'), getPart('month') - 1, getPart('day'), getPart('hour'), getPart('minute'), getPart('second'));

    const allMatches = await this.prisma.match.findMany({
      include: { teamA: true, teamB: true }
    });

    const notifications: any[] = [];
    let pendingScoresCount = 0;
    const pendingMatchesList: any[] = [];
    
    let semiFinalsReady = false;
    let finalReady = false;

    allMatches.forEach(m => {
      if (!m.matchDate) return;

      // 1. 🟢 REINTRODUZIDO: dbDate declarado no escopo correto para o isPastDay ler lá embaixo
      const dbDate = new Date(m.matchDate);
      const matchDateStr = m.matchDate.toString();
      
      // 2. Isolamos as horas e minutos REAIS salvos no banco
      const timePart = matchDateStr.split('T')[1] || '';
      const matchHours = Number(timePart.substring(0, 2) || '00');
      const matchMinutes = Number(timePart.substring(3, 5) || '00');

      const matchStartMinutes = (matchHours * 60) + matchMinutes;
      const matchEndMinutesForLive = matchStartMinutes + 90;       
      const matchEndMinutesForNotification = matchStartMinutes + 110; 
      
      // 3. Pegamos a hora e minuto atuais do servidor já convertidos para o fuso do Brasil
      const currentMinutes = (now.getHours() * 60) + now.getMinutes();

      // 4. Isolamos o dia e mês do jogo (YYYY-MM-DD)
      const matchMonthDayString = matchDateStr.split('T')[0];
      
      // Pegamos o dia e mês atual do fuso do Brasil
      const currentMonthDayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const isToday = matchMonthDayString === currentMonthDayString;

      if (m.status === 'SCHEDULED' && m.teamAId && m.teamBId) {
        if (m.phase === 'SEMI_FINALS') semiFinalsReady = true;
        if (m.phase === 'FINAL') finalReady = true;
      }

      // ====================================================================
      // ⏳ 1. PRE-MATCH (30 MINUTOS ANTES)
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
      // ⚽ 2. JOGO AO VIVO (BOLA ROLANDO - 90 MINUTOS)
      // ====================================================================
      const isLiveNow = m.status !== 'FINISHED' && 
                        m.teamAId && m.teamBId && 
                        isToday && 
                        currentMinutes >= matchStartMinutes && 
                        currentMinutes <= matchEndMinutesForLive;

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
      // ✏️ 3. AGUARDANDO PLACAR (SÓ COBRA APÓS 110 MINUTOS)
      // ====================================================================
      const isPastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() > 
                        new Date(dbDate.getUTCFullYear(), dbDate.getUTCMonth(), dbDate.getUTCDate()).getTime();

      const isTimeOver = m.status === 'SCHEDULED' && 
                         m.teamAId !== null &&
                         (m.goalsA === null || m.goalsB === null) &&
                         (isPastDay || (isToday && currentMinutes > matchEndMinutesForNotification));

      if (isTimeOver) {
        let dbDate = new Date(m.matchDate); // Mantém a referência caso use abaixo
        pendingScoresCount++;
        pendingMatchesList.push(m);
      }
    });

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
          description: `O tempo de ${m.teamA?.name} x ${m.teamB?.name} encerrou. Atualize a sua tabela.`,
          styleClass: 'bg-light text-secondary',
          icon: 'bi-pencil-square'
        });
      });
    }

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