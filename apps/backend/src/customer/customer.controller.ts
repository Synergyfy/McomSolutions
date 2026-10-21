import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomerService } from './customer.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get the authenticated customer profile fields not exposed by /auth/me',
  })
  @ApiOkResponse({ description: 'Customer profile' })
  getProfile(@Req() req: any) {
    return this.customerService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update the authenticated customer profile (phone only for now)' })
  @ApiOkResponse({ description: 'Updated customer profile' })
  updateProfile(@Req() req: any, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerService.updateProfile(req.user.userId, dto);
  }
}
