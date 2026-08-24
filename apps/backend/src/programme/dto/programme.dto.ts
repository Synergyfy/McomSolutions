import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateProgrammePhaseDto {
  @ApiProperty({ example: 'Business Foundation', description: 'Phase name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, description: 'Start day of the phase' })
  @IsInt()
  @Min(1)
  dayStart: number;

  @ApiProperty({ example: 7, description: 'End day of the phase' })
  @IsInt()
  @Min(1)
  dayEnd: number;

  @ApiProperty({ example: 'Verify identity, upload assets...', description: 'Phase description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'sky', description: 'UI accent colour key' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display ordering' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({
    example: [
      {
        id: 'verify-identity',
        title: 'Business Verification & Profile Foundation',
        description: 'Verify business identity and contact details.',
        estimatedMinutes: 15,
        reward: '+50 points',
        submissionType: 'internal_platform',
        system: 'MCOM Central',
        systemUrl: '',
        instructions: '',
        ctaLabel: 'Continue',
      },
    ],
    description: 'Phase missions (array of mission objects)',
  })
  @IsOptional()
  @IsArray()
  missions?: Record<string, unknown>[];
}

export class UpdateProgrammePhaseDto extends PartialType(CreateProgrammePhaseDto) {}

export class CreateReadinessGateDto {
  @ApiProperty({ example: 'Audit Access', description: 'Gate name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 80, description: 'Minimum progress percent required to unlock' })
  @IsInt()
  @Min(0)
  minProgressPercent: number;

  @ApiPropertyOptional({ example: true, description: 'Whether the gate is active' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateReadinessGateDto extends PartialType(CreateReadinessGateDto) {}

export class CreateSupportAgentDto {
  @ApiProperty({ example: 'Sarah Jones', description: 'Agent name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'agent', enum: ['agent', 'account_manager', 'consultant'], description: 'Agent role' })
  @IsEnum(['agent', 'account_manager', 'consultant'])
  role: 'agent' | 'account_manager' | 'consultant';

  @ApiProperty({ example: 'sarah@mcomsolutions.co.uk', description: 'Agent email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class UpdateSupportAgentDto extends PartialType(CreateSupportAgentDto) {}

export class CreateBusinessProgrammeDto {
  @ApiPropertyOptional({ example: 'b_123', description: 'Related business ID (if any)' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiProperty({ example: 'Toby Barbers', description: 'Business name' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiPropertyOptional({ example: 'Barber', description: 'Business sector' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ example: 4, description: 'Current day in the programme' })
  @IsOptional()
  @IsInt()
  currentDay?: number;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'paused', 'completed', 'extended'], description: 'Programme status' })
  @IsOptional()
  @IsEnum(['active', 'paused', 'completed', 'extended'])
  status?: 'active' | 'paused' | 'completed' | 'extended';

  @ApiPropertyOptional({ example: 'agent-2', description: 'Assigned agent ID' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ example: 'Sarah Jones', description: 'Assigned agent name' })
  @IsOptional()
  @IsString()
  agentName?: string;

  @ApiPropertyOptional({ example: 'am-3', description: 'Assigned account manager ID' })
  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @ApiPropertyOptional({ example: 'David Cole', description: 'Assigned account manager name' })
  @IsOptional()
  @IsString()
  accountManagerName?: string;

  @ApiPropertyOptional({ example: 'con-1', description: 'Assigned consultant ID' })
  @IsOptional()
  @IsString()
  consultantId?: string;

  @ApiPropertyOptional({ example: 'Dr. Amina Yusuf', description: 'Assigned consultant name' })
  @IsOptional()
  @IsString()
  consultantName?: string;

  @ApiPropertyOptional({ example: ['verify-identity'], description: 'Completed mission IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completedMissions?: string[];

  @ApiPropertyOptional({ example: '2026-07-03T00:00:00.000Z', description: 'Programme start date (ISO)' })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiPropertyOptional({ example: 0, description: 'Number of days extended' })
  @IsOptional()
  @IsInt()
  extendedBy?: number;

  @ApiPropertyOptional({ example: 'foundation', description: 'Current programme phase ID' })
  @IsOptional()
  @IsString()
  phaseId?: string;
}

export class UpdateBusinessProgrammeDto extends PartialType(CreateBusinessProgrammeDto) {}

export class UpdateTaskStatusDto {
  @ApiProperty({ example: 'verify-identity', description: 'Mission ID to update' })
  @IsString()
  @IsNotEmpty()
  missionId: string;

  @ApiProperty({ example: 'completed', enum: ['not_started', 'in_progress', 'completed'], description: 'Task status' })
  @IsEnum(['not_started', 'in_progress', 'completed'])
  status: 'not_started' | 'in_progress' | 'completed';
}

export class BusinessActionDto {
  @ApiProperty({
    example: 'extend',
    enum: ['pause', 'resume', 'fastTrack', 'extend', 'skipPhase', 'reset'],
    description: 'Action to perform on the business programme',
  })
  @IsEnum(['pause', 'resume', 'fastTrack', 'extend', 'skipPhase', 'reset'])
  action: 'pause' | 'resume' | 'fastTrack' | 'extend' | 'skipPhase' | 'reset';

  @ApiPropertyOptional({ example: 7, description: 'Days to extend (for extend action)' })
  @IsOptional()
  @IsInt()
  days?: number;
}

export class MissionDto {
  @ApiProperty({ example: 'verify-identity', description: 'Mission ID' })
  id: string;

  @ApiProperty({ example: 'Business Verification', description: 'Mission title' })
  title: string;

  @ApiProperty({ example: 'Verify business identity', description: 'Mission description' })
  description: string;

  @ApiPropertyOptional({ example: 15, description: 'Estimated minutes' })
  estimatedMinutes?: number;

  @ApiPropertyOptional({ example: '+50 points', description: 'Reward' })
  reward?: string;

  @ApiPropertyOptional({ example: 'internal_platform', description: 'Submission type' })
  submissionType?: string;

  @ApiPropertyOptional({ example: 'MCOM Central', description: 'System' })
  system?: string;

  @ApiPropertyOptional({ example: '', description: 'System URL' })
  systemUrl?: string;

  @ApiPropertyOptional({ example: '', description: 'Instructions' })
  instructions?: string;

  @ApiPropertyOptional({ example: 'Continue', description: 'CTA label' })
  ctaLabel?: string;
}

export class PhaseMissionsDto {
  @ApiProperty({ type: [MissionDto], description: 'Phase missions' })
  missions: MissionDto[];
}
