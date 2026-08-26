import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RotateSecretDto {
  @ApiPropertyOptional({ example: 'Compromised during incident response', description: 'Reason for rotation (recorded in the audit log)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}