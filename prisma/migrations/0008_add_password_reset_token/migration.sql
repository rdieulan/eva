-- Migration: add_password_reset_token
-- Adds a password reset token on User so admins can issue reset links
-- without ever seeing the new password.

ALTER TABLE "User"
  ADD COLUMN "passwordResetToken" TEXT,
  ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");
