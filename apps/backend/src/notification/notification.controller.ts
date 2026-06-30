import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    return this.notificationService.getNotifications(req.user.businessId);
  }

  @Post('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationService.markAllAsRead(req.user.businessId);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Request() req: any, @Param('id') id: string) {
    await this.notificationService.deleteNotification(req.user.businessId, id);
    return { success: true };
  }
}
