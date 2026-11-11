// The colour code (docs/PRODUIT.md, *Code couleur*): what an item is about,
// its subject, gives it one colour and one symbol wherever it shows; what
// happens to it, its state, has colours of its own.

/** What a reminder of the home, or a notification, is about; an event is one of those a venue publishes, open to all */
export type Subject = 'match' | 'dispos' | 'matchmaking' | 'competition' | 'event' | 'team';

/**
 * How an item is coloured: its subject's colour, or, gone wrong, the state it
 * came to. Refused: their team said no, or the match was called off (red).
 * Fell through: it came to nothing (grey).
 */
export type SubjectTone = 'subject' | 'refused' | 'fell-through';

/** How a notification shows: the symbol of its subject, in the colour of its tone */
export interface NotificationLook {
  subject: Exclude<Subject, 'dispos'>;
  tone: SubjectTone;
}
