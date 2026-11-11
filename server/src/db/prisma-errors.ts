// What a failed Prisma query says about why it failed

import { Prisma } from '@prisma/client';

// Prisma's codes for a unique constraint violation, and for a foreign key one
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

/** Whether a write failed because another row already holds one of its unique values */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}

/** Whether a write failed because a row it points to is gone */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === FOREIGN_KEY_VIOLATION;
}
