import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GeographyModule } from '../geography/geography.module';

@Module({
  imports: [GeographyModule],
  controllers: [CustomerController],
  providers: [CustomerService, RolesGuard],
  exports: [CustomerService],
})
export class CustomerModule {}
