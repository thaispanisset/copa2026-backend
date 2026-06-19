import { Controller, Get, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('live')
  async getLiveNotifications() {
    return this.notificationsService.getLiveNotifications();
  }

  @Post('register-token')
  async registerToken(
    @Body() body: { username: string; deviceToken: string }
  ) {
    return this.notificationsService.registerToken(body.username, body.deviceToken);
  }

  @Get('teste-push')
  async enviarNotificacaoTeste() {
    await this.notificationsService.sendPushNotification(
      '⚽ COPA 2026 - TESTE NATIVO!',
      'Deu certo! Se você está lendo isso, o push do Firebase funcionou direto do PC. 🔥'
    );
    return { message: 'Disparo de teste efetuado! Olhe o celular e o terminal.' };
  }
}