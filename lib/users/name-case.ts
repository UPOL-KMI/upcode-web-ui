/**
 * Repairing a name a study information system exported in capitals (X-015).
 *
 * STAG's `getStudentiByPredmet` writes surnames as `BENEŠ`, and an import that takes it literally
 * puts that in the person's profile, where it then shouts from every solution list and every
 * e-mail for the rest of their studies. Nobody's surname is actually spelled that way.
 *
 * **Only a cell that carries no information is rewritten.** A single lower-case letter anywhere
 * means the export preserved the real spelling, and then this does nothing -- which is what keeps
 * `van der Berg`, `McDonald` and `de la Cruz` safe when they arrive spelled correctly. The rule is
 * deliberately about the *cell*, not about the name: there is no way to tell `NOVAK` the shouted
 * surname from `NOVAK` the surname of somebody who writes it that way, and the first is what a
 * STAG export contains.
 *
 * What comes out of a genuinely capitalised cell is a guess, and it is shown to the teacher in the
 * import's own text box before anything is written, so a wrong one can be typed over. `DE LA CRUZ`
 * becomes `De La Cruz`, which is not right; it is closer than `DE LA CRUZ` and it is visible.
 */

/** Segment boundaries inside a name: spaces, hyphens of both kinds, and apostrophes of both. */
const BOUNDARY = /([\s\-‐‑–'’])/;

/** Has the cell no lower-case letter at all? `toLocaleLowerCase` is the comparison rather than a
 *  character class, so `Ě`, `Ř` and `Ů` count as letters that changed case. */
function isAllCaps(value: string): boolean {
  const lowered = value.toLocaleLowerCase("cs");
  return lowered !== value && lowered.toLocaleUpperCase("cs") === value;
}

/**
 * `BENEŠ` → `Beneš`, `NOVÁKOVÁ-DVOŘÁKOVÁ` → `Nováková-Dvořáková`, `O'BRIEN` → `O'Brien`.
 * Anything already carrying a lower-case letter is returned untouched.
 */
export function fixShoutedName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2 || !isAllCaps(trimmed)) return value;

  return trimmed
    .toLocaleLowerCase("cs")
    .split(BOUNDARY)
    .map((part) =>
      BOUNDARY.test(part) || part === "" ? part : part[0]!.toLocaleUpperCase("cs") + part.slice(1),
    )
    .join("");
}
