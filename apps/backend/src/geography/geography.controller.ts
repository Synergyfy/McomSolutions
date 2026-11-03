import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostcodeService } from './postcode.service';

@ApiTags('Geography')
@Controller('geography')
export class GeographyController {
  constructor(private readonly postcodeService: PostcodeService) {}

  @Post('validate-postcode')
  @ApiOperation({
    summary: 'Validate a UK postcode and resolve its geographic hierarchy',
  })
  async validatePostcode(@Body('postcode') postcode: string) {
    const resolved = await this.postcodeService.resolve(postcode || '');
    return { success: true, data: resolved };
  }
}
