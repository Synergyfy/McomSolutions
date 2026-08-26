import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';
import { ConsoleAdminGuard } from './guards/console-admin.guard';

@Module({
  imports: [
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, ConsoleAdminGuard],
  exports: [ConsoleService],
})
export class ConsoleModule {}