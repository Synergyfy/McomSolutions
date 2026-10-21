import { Controller, Get, Post, Patch, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService, NotificationIdentity } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
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
  @ApiOperation({
    summary:
      'List notifications for the caller. No query = legacy array; page/limit/category/unreadOnly/search = paginated envelope with unreadCount',
  })
  @ApiOkResponse({ description: 'Notifications retrieved' })
  async getNotifications(@Request() req: any, @Query() query: NotificationQueryDto) {
    return this.notificationService.getNotifications(this.toIdentity(req), query);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the caller-owned unread notification count' })
  @ApiOkResponse({ description: 'Unread notification count' })
  async getUnreadCount(@Request() req: any) {
    return this.notificationService.getUnreadCount(this.toIdentity(req));
  }

  @Post('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark the caller’s own notifications as read (broadcasts excluded)' })
  @ApiOkResponse({ description: 'Notifications marked as read' })
  async markAllAsRead(@Request() req: any) {
    await this.notificationService.markAllAsRead(this.toIdentity(req));
    return { success: true };
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark one caller-owned notification as read' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  async markOneAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationService.markOneAsRead(this.toIdentity(req), id);
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
