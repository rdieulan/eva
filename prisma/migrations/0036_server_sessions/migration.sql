-- Sessions are checked by the server on every request. The browser keeps a
-- random token in a cookie its scripts cannot read; the database keeps only its
-- hash. The sessions opened before held a signed token that nothing checked
-- here: they end, and everyone signs in again.
DELETE FROM "Session";

DROP INDEX "Session_token_key";
DROP INDEX "Session_token_idx";
ALTER TABLE "Session" DROP COLUMN "token";
ALTER TABLE "Session" ADD COLUMN "tokenHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
