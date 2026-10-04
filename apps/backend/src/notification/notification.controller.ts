import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService, NotificationIdentity } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private toIdentity(req: any): NotificationIdentity {
    return { userId: req.user?.userId ?? null, businessId: req.user?.businessId ?? null };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List notifications for the caller (userId first, businessId fallback, plus broadcasts)' })
  @ApiOkResponse({ description: 'Notifications retrieved' })
  async getNotifications(@Request() req: any) {
    return this.notificationService.getNotifications(this.toIdentity(req));
  }

  @Post('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark the caller’s own notifications as read (broadcasts excluded)' })
  @ApiOkResponse({ description: 'Notifications marked as read' })
  async markAllAsRead(@Request() req: any) {
    await this.notificationService.markAllAsRead(this.toIdentity(req));
    return { success: true };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete one of the caller’s own notifications' })
  @ApiOkResponse({ description: 'Notification deleted' })
  async deleteNotification(@Request() req: any, @Param('id') id: string) {
    await this.notificationService.deleteNotification(this.toIdentity(req), id);
    return { success: true };
  }
}
