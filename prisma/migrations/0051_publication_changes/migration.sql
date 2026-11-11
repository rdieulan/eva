-- What a team is told when the venue changes a competition it accepted or has
-- not answered yet, or an event it added to its calendar
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'COMPETITION_CHANGED';
ALTER TYPE "NotificationKind" ADD VALUE 'VENUE_EVENT_CHANGED';
