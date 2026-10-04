import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Phase 5: soft-deleted rows still occupy unique columns (e.g. User.email),
 * so a check-then-create can lose a race — or hit a trashed row the
 * soft-delete extension deliberately hides. Translate the unique violation
 * into a 409 instead of leaking a 500.
 */
export function rethrowAsConflictOnUniqueViolation(
  error: unknown,
  message = 'Email already registered',
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException(message);
  }
  throw error;
}
