import { Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Define a rota base como http://localhost:3000/notifications
@Controller('notifications')
export class NotificationsController {
  
  // Injeta o Service de notificações que criamos no passo anterior
  constructor(private readonly notificationsService: NotificationsService) {}

  // Expõe o método na rota http://localhost:3000/notifications/live
  @Get('live')
  async getLiveNotifications() {
    return this.notificationsService.getLiveNotifications();
  }
}