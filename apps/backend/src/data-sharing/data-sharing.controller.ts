import { Controller, Get, Post, Query, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { DataSharingService } from './data-sharing.service';
import { HmacAuthGuard } from './guards/hmac-auth.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiOkResponse, ApiHeader } from '@nestjs/swagger';
import { QueryUserDto } from './dto/query-user.dto';
import { BulkUserDto } from './dto/bulk-user.dto';
import { LocalMallLookupService } from '../geography/local-mall-lookup.service';

@ApiTags('Data Sharing API (Server-to-Server)')
@ApiHeader({ name: 'X-Service-Id', description: 'Calling MCOM service identifier (e.g. mcom-rewards)', required: true })
@ApiHeader({ name: 'X-Timestamp', description: 'Unix timestamp (seconds) of the request', required: true })
@ApiHeader({ name: 'X-Signature', description: 'HMAC-SHA256(serviceId:timestamp, sharedSecret) as hex', required: true })
@Controller('data')
@UseGuards(HmacAuthGuard)
export class DataSharingController {
  constructor(
    private readonly dataSharingService: DataSharingService,
    private readonly localMallLookupService: LocalMallLookupService,
  ) {}

  @Get('local-mall')
  @ApiOperation({
    summary:
      'Resolve the local mall assigned to a user, or the closest mall to a UK postcode',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Central user id. Prefers the mall already assigned to the profile.',
  })
  @ApiQuery({
    name: 'postcode',
    required: false,
    description: 'UK postcode used to resolve the local mall when no assignment exists.',
  })
  async getLocalMall(
    @Query('userId') userId?: string,
    @Query('postcode') postcode?: string,
  ) {
    if (!userId && !postcode) {
      throw new BadRequestException(
        'Either userId or postcode query parameter is required',
      );
    }
    const data = await this.localMallLookupService.resolve({
      userId: userId?.trim() || null,
      postcode: postcode?.trim() || null,
    });
    return { success: true, data };
  }

  @Get('user')
  @ApiOperation({ summary: 'Query single user profile and packages context by email or userId' })
  @ApiQuery({ type: QueryUserDto })
  @ApiOkResponse({ description: 'User context retrieved successfully' })
  async getUser(@Query() query: QueryUserDto) {
    if (!query.email && !query.userId) {
      throw new BadRequestException('Either email or userId query parameter is required');
    }
    const user = await this.dataSharingService.getUserContext(query.email, query.userId);
    return {
      success: true,
      data: user,
    };
  }

  @Get('user/:userId/membership')
  @ApiOperation({ summary: 'Query user membership details' })
  @ApiOkResponse({ description: 'Membership retrieved successfully' })
  async getMembership(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const membership = await this.dataSharingService.getUserMembership(userId);
    return {
      success: true,
      data: membership,
    };
  }

  @Get('user/:userId/packages')
  @ApiOperation({ summary: 'Query user registered platform packages' })
  @ApiOkResponse({ description: 'Packages list retrieved successfully' })
  async getPackages(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const packages = await this.dataSharingService.getUserPackages(userId);
    return {
      success: true,
      data: packages,
    };
  }

  @Get('user/:userId/permissions')
  @ApiOperation({ summary: 'Query calculated user access permissions' })
  @ApiOkResponse({ description: 'Calculated permission flags retrieved successfully' })
  async getPermissions(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const permissions = await this.dataSharingService.getUserPermissions(userId);
    return {
      success: true,
      data: permissions,
    };
  }

  @Post('user/bulk')
  @ApiOperation({ summary: 'Bulk query multiple user profiles by array of emails or userIds' })
  @ApiBody({ type: BulkUserDto })
  @ApiOkResponse({ description: 'Bulk users list retrieved successfully' })
  async getBulkUsers(@Body() dto: BulkUserDto) {
    const users = await this.dataSharingService.getBulkUserContexts(dto.emailsOrIds);
    return {
      success: true,
      data: users,
    };
  }
}
