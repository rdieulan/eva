-- A venue's name in the address of its public board ("/salles/nimes"), set
-- once: a venue renamed later keeps it, so the links already shared keep
-- working. New venues get theirs from freeVenueSlug (shared/utils); the
-- venues already there get the same reading of their name here: accents
-- dropped, lowercase, a dash between words, "-2", "-3"... after a name
-- another venue already holds.
ALTER TABLE "Venue" ADD COLUMN "slug" TEXT;

DO $$
DECLARE
  venue RECORD;
  base TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR venue IN SELECT "id", "name" FROM "Venue" ORDER BY "createdAt", "id" LOOP
    -- Accented letters of either case are read plain before lower(), which
    -- only knows ASCII under some database locales
    base := lower(replace(replace(replace(replace(translate(venue."name",
      'ÀÁÂÃÄÅĀÇĆČÈÉÊËĒĖĘÌÍÎÏĪĮŁÑŃÒÓÔÕÖØŌÙÚÛÜŪÝŸŽŹŻàáâãäåāçćčèéêëēėęìíîïīįłñńòóôõöøōùúûüūýÿžźż',
      'aaaaaaaccceeeeeeeiiiiiilnnooooooouuuuuyyzzzaaaaaaaccceeeeeeeiiiiiilnnooooooouuuuuyyzzz'),
      'Œ', 'oe'), 'œ', 'oe'), 'Æ', 'ae'), 'æ', 'ae'));
    base := trim(BOTH '-' FROM regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
    IF base = '' THEN
      base := 'salle';
    END IF;

    candidate := base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "Venue" WHERE "slug" = candidate) LOOP
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    END LOOP;
    UPDATE "Venue" SET "slug" = candidate WHERE "id" = venue."id";
  END LOOP;
END $$;

ALTER TABLE "Venue" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
