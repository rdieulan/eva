// Search utilities: names compared the way a reader compares them

// The marks a decomposed letter keeps apart from it: accents, cedillas
const MARKS = /\p{M}/gu;
// Letters no decomposition splits, written out the way they are typed
const WHOLE_LETTERS: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss', ø: 'o', ł: 'l', đ: 'd' };
const WHOLE_LETTER = /[œæßøłđ]/g;
// Whatever stands between words: anything neither a letter nor a digit
const BETWEEN_WORDS = /[^\p{L}\p{N}]+/gu;

/**
 * A text the way a search compares it: "Nîmes", "NIMES" and "nimes !" all
 * read "nimes". Lowercase, accents dropped, decorated letters (full-width,
 * script) made plain, one space between words whatever separated them;
 * emojis and punctuation go.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(WHOLE_LETTER, letter => WHOLE_LETTERS[letter]!)
    .replace(BETWEEN_WORDS, ' ')
    .trim();
}
