import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AppServicePolicyDto {
  @ApiProperty({ example: 'mcom-mall', description: 'App clientId this policy applies to' })
  @IsString()
  @MaxLength(50)
  clientId: string;

  @ApiProperty({
    example: ['mcom-reward'],
    description: 'Peers this app may call. Empty = deny all; ["*"] = any registered app.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  allowedAudiences: string[];

  @ApiProperty({
    example: ['mcom-mall'],
    description: 'Peers permitted to call this app. Empty = deny all; ["*"] = any registered app.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  allowedCallers: string[];
}

export class SetServicePolicyDto {
  @ApiProperty({ type: [AppServicePolicyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppServicePolicyDto)
  @ArrayMaxSize(1000)
  apps: AppServicePolicyDto[];
}
