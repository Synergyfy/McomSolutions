import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceConnectorsModule } from '../service-connectors/service-connectors.module';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminOpsController } from './admin-ops.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminService } from './admin.service';
import { AdminOpsService } from './admin-ops.service';
import { AdminCatalogService } from './admin-catalog.service';

@Module({
  imports: [
    PrismaModule,
    ServiceConnectorsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController, AdminAuthController, AdminOpsController, AdminCatalogController],
  providers: [AdminService, AdminOpsService, AdminCatalogService],
  exports: [AdminService, AdminOpsService, AdminCatalogService],
})
export class AdminModule {}
