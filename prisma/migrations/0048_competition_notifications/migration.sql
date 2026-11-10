-- What a venue's competitions tell the teams: offered, added to a team's
-- calendar, withdrawn
ALTER TYPE "NotificationKind" ADD VALUE 'COMPETITION_OFFERED';
ALTER TYPE "NotificationKind" ADD VALUE 'COMPETITION_ADDED';
ALTER TYPE "NotificationKind" ADD VALUE 'COMPETITION_WITHDRAWN';
