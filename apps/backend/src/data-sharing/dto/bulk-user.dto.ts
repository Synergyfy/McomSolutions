import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class BulkUserDto {
  @ApiProperty({ example: ['john@example.com', 'user-uuid'], description: 'List of emails or user IDs to bulk query' })
  @IsArray()
  @IsString({ each: true })
  emailsOrIds: string[];
}
