import { PartialType, OmitType } from '@nestjs/swagger';
import { RegisterAppDto } from './register-app.dto';

/**
 * PATCH semantics — every field optional.
 * `clientId` and `isSystemApp` are not updatable via the Console:
 *   - clientId is the app identity (never changeable after registration).
 *   - isSystemApp is a protected system flag.
 */
export class UpdateAppDto extends OmitType(PartialType(RegisterAppDto), [
  'clientId',
  'isSystemApp',
] as const) {}