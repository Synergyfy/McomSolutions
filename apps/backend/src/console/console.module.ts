import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';
import { ConsoleAdminGuard } from './guards/console-admin.guard';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    AuthModule,
    WebhookDispatcherModule,
    QueueModule,
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, ConsoleAdminGuard],
  exports: [ConsoleService],
})
export class ConsoleModule {}