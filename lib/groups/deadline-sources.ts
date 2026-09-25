/**
 * Which of somebody's groups contribute deadlines to their dashboard (X-017).
 *
 * Its own module rather than two expressions inside `lib/api/dashboard.ts`: the choice it encodes
 * is the whole of the ticket and is a single word wide of being wrong again, and `dashboard.ts`
 * imports `server-only`, so nothing in it can be reached from a test.
 */

export interface DeadlineSource {
  id: string;
  organizational: boolean;
}

/**
 * **The teaching half is direct membership only.** `teachingDirect` is the set a person is *named*
 * on; `teaching` additionally carries every group inherited from an ancestor they administer, so a
 * department's administrator opening the dashboard would be handed every colleague's course
 * (DEC-150 made the sidebar follow the narrow set; this is the same rule for the two places that
 * round left alone). Nothing is taken away by it -- an inherited administrator still reaches those
 * courses through `/groups` and still may act in them.
 *
 * **`member` stays wide**, because a student's own deadlines belong in their month whatever they
 * teach, and a group they both study in and teach must appear once rather than twice.
 *
 * Containers are dropped from both: core-api refuses to create an assignment in an organizational
 * group, and refuses to make one organizational once it holds any, so asking it for its assignments
 * is a round trip whose answer is known.
 */
export function deadlineSources<T extends DeadlineSource>(mine: {
  member: T[];
  teachingDirect: T[];
}): { teaching: T[]; calendar: T[] } {
  const holdsAssignments = (group: T) => !group.organizational;
  const teaching = mine.teachingDirect.filter(holdsAssignments);
  const calendar = [
    ...new Map(
      [...mine.member, ...mine.teachingDirect].filter(holdsAssignments).map((g) => [g.id, g]),
    ).values(),
  ];
  return { teaching, calendar };
}
