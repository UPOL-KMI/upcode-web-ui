import type { FileEntry } from "./simple-config";

/**
 * Whether a chosen entry point will actually be in the sandbox when the test runs (X-024).
 *
 * **Naming a file and delivering it are two different fields, and the screen shows them side by
 * side.** `entry-point` writes a name into the run command; `extra-files` is the only thing that
 * copies anything into the box. The normal case hides this: a student submits `main.py`,
 * `utils.py` and `helpers.py`, the author says which one is the program, and it is already there
 * because the student sent it.
 *
 * The case that bites is the other one. An author uploads a harness to the exercise, picks it from
 * the entry-point dropdown -- which lists the exercise's own files, so it looks like a complete
 * decision -- and leaves Extra files empty. Every test then dies with
 * `FileNotFoundError: '/box/main.py'`, and the job configuration shows why: the name appears once
 * per test as the run command's argument and in no `fetch` or `cp` task at all. That is how the
 * operator lost an afternoon on the first package exercise.
 *
 * **This warns; it does not refuse, and it does not fix anything by itself.** Auto-adding the file
 * to Extra files would be wrong for the case the field exists for -- a student's own file, which
 * the exercise must *not* supply -- and would read as magic. A name that is both an exercise file
 * and an expected submission is unusual but legal, so the answer is "you probably forgot
 * something", not "this is invalid".
 */

/** The name a pair puts in the sandbox: the new name where one was typed, the file's own otherwise
 *  -- which is what the field's "(optional) new file name" has always promised. */
export function deliveredAs(entry: FileEntry): string {
  return entry.name.trim() || entry.file;
}

/**
 * True when the warning belongs on the field.
 *
 * `exerciseFiles` is what the dropdown was built from, and it is what separates the two cases: a
 * name that is *not* an exercise file can only be one the student is expected to submit, and
 * nothing here can or should say whether they will.
 */
export function entryPointIsUndelivered(
  entryPoint: string,
  extraFiles: readonly FileEntry[],
  exerciseFiles: readonly string[],
): boolean {
  const wanted = entryPoint.trim();
  if (wanted === "") return false;
  if (!exerciseFiles.includes(wanted)) return false;
  return !extraFiles.some((entry) => entry.file !== "" && deliveredAs(entry) === wanted);
}

/**
 * What the entry-point dropdown offers: **only what this test's extra files deliver.**
 *
 * Not the exercise's attachments. Listing those was the whole trap -- they look available and are
 * not, because attaching a file to an exercise puts it nowhere near the sandbox. The list is
 * therefore empty until the author adds an extra file, and the field says why.
 *
 * A pair that renames is offered under the name it lands as, since that is what the run command
 * will have to say.
 *
 * `FileSelect` keeps a configured value selectable even when it is not in this list, which matters
 * for the case this screen cannot express: an entry point naming one of the *student's* submitted
 * files. Opening the form and saving it must not quietly drop that.
 */
export function entryPointChoices(extraFiles: readonly FileEntry[]): string[] {
  return [
    ...new Set(extraFiles.filter((entry) => entry.file !== "").map((entry) => deliveredAs(entry))),
  ];
}
