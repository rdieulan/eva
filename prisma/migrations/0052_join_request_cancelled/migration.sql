-- A request to join a team that the player took back is kept, so that the
-- team does not hear from them again too soon
-- AlterEnum
ALTER TYPE "JoinRequestStatus" ADD VALUE 'CANCELLED';
