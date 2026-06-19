import { Controller, Get, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('live')
  async getLiveNotifications() {
    return this.notificationsService.getLiveNotifications();
  }

  // 🟢 NOVA ROTA: Recebe e registra o Token FCM do celular na tabela do TiDB
  @Post('register-token')
  async registerToken(
    @Body() body: { username: string; deviceToken: string }
  ) {
    return this.notificationsService.registerToken(body.username, body.deviceToken);
  }
}