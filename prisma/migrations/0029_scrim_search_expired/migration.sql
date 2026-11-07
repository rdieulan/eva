-- A search closes with no match made when its day passes or eva.gg no longer
-- opens its slots to a match
ALTER TYPE "ScrimSearchStatus" ADD VALUE 'EXPIRED';
