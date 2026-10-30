import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponModule } from '../coupon/coupon.module';
import { EcosystemEventsModule } from '../ecosystem-events/ecosystem-events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { MailModule } from '../common/mail/mail.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [AuthModule, CouponModule, EcosystemEventsModule, PrismaModule, WalletModule, MailModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
