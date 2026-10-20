import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../common/mail/mail.module';
import { AdminCouponController } from './admin-coupon.controller';
import { CouponUserController } from './coupon-user.controller';
import { CouponService } from './coupon.service';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [AdminCouponController, CouponUserController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
