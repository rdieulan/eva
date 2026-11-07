-- A slot is one arena at one hour. eva.gg's slot id names the hour of the
-- venue, the same on each of its arenas, so the ids kept are now followed by
-- their arena, as the slots read from eva.gg are. A match saved without an
-- arena is played in a venue of one arena: the match form only records the
-- arena when the venue has several.

UPDATE "ScrimSearchSlot"
SET "evaSlotId" = "evaSlotId" || '-' || "arenaNumber";

UPDATE "ScrimProposal"
SET "evaSlotIds" = ARRAY(
  SELECT slot.id || '-' || "ScrimProposal"."arenaNumber"
  FROM unnest("ScrimProposal"."evaSlotIds") WITH ORDINALITY AS slot(id, position)
  ORDER BY slot.position
);

UPDATE "CalendarEvent"
SET "evaSlotIds" = ARRAY(
  SELECT slot.id || '-' || COALESCE("CalendarEvent"."arenaNumber", 1)
  FROM unnest("CalendarEvent"."evaSlotIds") WITH ORDINALITY AS slot(id, position)
  ORDER BY slot.position
)
WHERE cardinality("evaSlotIds") > 0;
