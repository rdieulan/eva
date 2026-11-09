// League teams display helpers: the teams of the leagues played on competitive.eva.gg

/** How many players a league team counts, in words: "1 membre", "5 membres" */
export function formatMemberCount(count: number): string {
  return `${count} membre${count > 1 ? 's' : ''}`;
}
