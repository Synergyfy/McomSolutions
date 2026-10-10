import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDirectConversationDto {
  @ApiProperty({ description: 'ID of user to start conversation with' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class CreateGroupConversationDto {
  @ApiProperty({ description: 'Name of the group conversation' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'List of participant user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  participantIds: string[];

  @ApiPropertyOptional({ description: 'Optional group avatar image URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Target conversation ID' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ description: 'Message text content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ description: 'Message type (TEXT, SYSTEM, IMAGE, FILE)', default: 'TEXT' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Client-generated idempotency key' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Optional metadata attachments or mentions' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class HttpSendMessageDto {
  @ApiProperty({ description: 'Message text content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ description: 'Message type (TEXT, SYSTEM, IMAGE, FILE)', default: 'TEXT' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Client-generated idempotency key' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Optional metadata attachments or mentions' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class MarkReadDto {
  @ApiProperty({ description: 'Target conversation ID' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiPropertyOptional({ description: 'Optional specific message IDs to mark read', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  messageIds?: string[];
}

export class AddParticipantDto {
  @ApiProperty({ description: 'User ID to add to conversation' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class MuteConversationDto {
  @ApiProperty({ description: 'Mute state boolean' })
  @IsBoolean()
  isMuted: boolean;
}

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'p256dh public key' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: 'auth secret' })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ description: 'Web Push subscription endpoint' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ description: 'Encryption keys' })
  @IsObject()
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional({ description: 'Client browser or device user agent' })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Direct message notifications' })
  @IsBoolean()
  @IsOptional()
  directMessages?: boolean;

  @ApiPropertyOptional({ description: 'Group message notifications' })
  @IsBoolean()
  @IsOptional()
  groupMessages?: boolean;

  @ApiPropertyOptional({ description: 'Enable Web Push notifications' })
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Do Not Disturb mode' })
  @IsBoolean()
  @IsOptional()
  dndEnabled?: boolean;

  @ApiPropertyOptional({ description: 'DND start time (e.g. 22:00)' })
  @IsString()
  @IsOptional()
  dndStartTime?: string;

  @ApiPropertyOptional({ description: 'DND end time (e.g. 08:00)' })
  @IsString()
  @IsOptional()
  dndEndTime?: string;
}

export class SendMessageRequestDto {
  @ApiProperty({ description: 'ID of the user to request chat with' })
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiPropertyOptional({ description: 'Optional initial introduction message' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}

export class RespondMessageRequestDto {
  @ApiProperty({ description: 'Response action: ACCEPT or REJECT', enum: ['ACCEPT', 'REJECT'] })
  @IsString()
  @IsNotEmpty()
  action: 'ACCEPT' | 'REJECT';
}

export class BlockUserDto {
  @ApiProperty({ description: 'ID of the user to block or unblock' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

