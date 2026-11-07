-- A match made by the matchmaking can be called off by either team: its
-- proposal keeps the trace
ALTER TYPE "ScrimProposalStatus" ADD VALUE 'CANCELLED';
