import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Phase 4: shared body for POST /business/support-tickets. */
export class CreateSupportTicketDto {
  @ApiProperty({ example: 'Cannot access dashboard', description: 'Ticket subject' })
  @IsString()
  @IsNotEmpty({ message: 'subject is required' })
  @MaxLength(200, { message: 'subject must be at most 200 characters' })
  subject: string;

  @ApiProperty({ example: 'Getting 403 error on login since yesterday', description: 'Ticket message' })
  @IsString()
  @IsNotEmpty({ message: 'message is required' })
  @MaxLength(5000, { message: 'message must be at most 5000 characters' })
  message: string;

  @ApiPropertyOptional({ example: 'High', enum: ['Low', 'Medium', 'High'], description: 'Ticket priority' })
  @IsOptional()
  @IsString()
  @IsIn(['Low', 'Medium', 'High'], { message: 'priority must be Low, Medium, or High' })
  priority?: string;
}
