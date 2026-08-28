import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';
import { ConsoleAdminGuard } from './guards/console-admin.guard';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, ConsoleAdminGuard],
  exports: [ConsoleService],
})
export class ConsoleModule {}