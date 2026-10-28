import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponModule } from '../coupon/coupon.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { MailModule } from '../common/mail/mail.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { ServiceConnectorsModule } from '../service-connectors/service-connectors.module';

@Module({
  imports: [AuthModule, CouponModule, PrismaModule, WalletModule, MailModule, ServiceConnectorsModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
