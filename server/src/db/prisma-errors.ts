// What a failed Prisma query says about why it failed

import { Prisma } from '@prisma/client';

// Prisma's code for a unique constraint violation
const UNIQUE_VIOLATION = 'P2002';

/** Whether a write failed because another row already holds one of its unique values */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}
