import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GeographyModule } from '../geography/geography.module';
import { ProfileSyncModule } from '../profile-sync/profile-sync.module';

@Module({
  imports: [GeographyModule, ProfileSyncModule],
  controllers: [CustomerController],
  providers: [CustomerService, RolesGuard],
  exports: [CustomerService],
})
export class CustomerModule {}
