"use server";

import { ApiError, apiPost } from "@/lib/api/client";
import { apiRead } from "@/lib/api/read";
import { getCurrentUser } from "@/lib/api/current-user";
import { MAX_ROWS, type ImportOutcome, type RosterRow } from "@/lib/users/import-roster";

/**
 * The bulk import of people (AD-009, reopened by X-015).
 *
 * **core-api has no bulk endpoint, and this is not pretending otherwise**: it walks the rows and
 * calls the one-person endpoints, reporting each row's own outcome. What makes that bearable is
 * that the whole thing is *re-runnable over the same file*, which it has to be for a reason that
 * is not obvious:
 *
 * **An invitation does not create the account.** `POST /v1/users/invite` signs a token carrying
 * the person's details and emails it; the row in the database appears only once they open the link
 * and choose a password (`InvitationHelper::invite`). Identifiers used to be impossible to record
 * for such a person -- there was no account to hang them on -- which made this a two-pass import.
 * **The fork now carries them in the invitation token itself** (`xid`), and
 * `RegistrationPresenter::actionAcceptInvitation` writes them the moment the account comes into
 * being. One pass is enough.
 *
 * What that costs is that a clash can no longer be reported when it happens: the invitation is
 * already in somebody's inbox by then. So core-api refuses the invitation outright if an
 * identifier is already held by another account, naming the owner -- and this file surfaces that
 * refusal against the row that caused it.
 *
 * **The two halves of the import are genuinely different operations**, and the screen says so:
 * somebody without an account is *invited* and joins the group only when they accept, while
 * somebody who already has one is *added* to the group then and there, with no mail sent. The
 * second half is the one that was missing (X-015): an existing account used to be reported as
 * handled and never actually joined anything, so an import into a second-year cohort -- where
 * nearly everybody already has an account -- looked entirely successful and enrolled almost
 * nobody.
 *
 * Rows are processed a few at a time rather than all at once: each invitation sends mail through
 * the deployment's SMTP relay, and a hundred at once is how a relay decides you are spam.
 */
const CONCURRENCY = 3;

interface DirectoryEnvelope {
  items: { id: string; privateData?: { email?: string } | null }[];
}

/** core-api's user search matches first name, last name **and** email, so the hit has to be
 *  confirmed on the address rather than trusted positionally. */
async function findByEmail(email: string): Promise<string | null> {
  const envelope = await apiRead<DirectoryEnvelope>("/v1/users", {
    query: { limit: 10, offset: 0, "filters[search]": email },
  });
  const wanted = email.toLowerCase();
  const hit = envelope.items.find((user) => user.privateData?.email?.toLowerCase() === wanted);
  return hit?.id ?? null;
}

/**
 * What the caller may do in one target group, and who is already in it.
 *
 * `inviteStudents` is a genuine permission hint -- `canInviteStudents(Group)` takes one argument,
 * so `PermissionHints::get` reflects it onto every group payload -- which is why this screen can
 * be offered to whoever core-api would actually let use it rather than to a role guessed at from
 * outside (X-015, DEC-151). core-api checks the same thing again per invitation; asking here only
 * buys a refusal in one sentence instead of one per row.
 */
interface GroupGate {
  id: string;
  canInvite: boolean;
  students: Set<string>;
}

async function readGroupGate(id: string): Promise<GroupGate> {
  try {
    const group = await apiRead<{
      permissionHints?: Record<string, boolean>;
      privateData?: { students?: string[] } | null;
      archived?: boolean;
      organizational?: boolean;
    }>("/v1/groups/{id}", { pathParams: { id } });

    return {
      id,
      canInvite:
        group.permissionHints?.inviteStudents === true &&
        group.archived !== true &&
        group.organizational !== true,
      students: new Set(group.privateData?.students ?? []),
    };
  } catch {
    return { id, canInvite: false, students: new Set() };
  }
}

async function writeIdentifiers(
  userId: string,
  externalIds: Record<string, string>,
): Promise<Pick<ImportOutcome, "identifiersSet" | "identifiersFailed">> {
  const identifiersSet: string[] = [];
  const identifiersFailed: { service: string; code: string }[] = [];

  for (const [service, externalId] of Object.entries(externalIds)) {
    try {
      await apiPost(
        "/v1/users/{id}/external-login/{service}",
        { externalId },
        { pathParams: { id: userId, service } },
      );
      identifiersSet.push(service);
    } catch (error) {
      identifiersFailed.push({ service, code: identifierFailure(error) });
    }
  }

  return { identifiersSet, identifiersFailed };
}

/**
 * **A 403 here is ordinary, not a fault.** `user.setExternalIds` is granted to the superadmin
 * alone, so a teacher importing their own cohort cannot write a study number onto an account that
 * already exists -- only onto one their invitation brings into being, where the identifier rides
 * in the token and is written by the registration itself. Reported as its own code so the screen
 * can say who has to finish the job, rather than showing core-api's bare English refusal.
 */
function identifierFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return "unknown";
  return error.httpStatus === 403 ? "forbidden" : error.code;
}

/**
 * What to put in front of the person running the import when a row is refused.
 *
 * **core-api's own sentence, English and all** -- the one place in this app that shows it rather
 * than translating the code beside it. Every other screen has one thing that can go wrong and can
 * say so in the reader's language; here the code is almost always the generic `400-000` and the
 * sentence is the only thing that distinguishes "this identifier belongs to somebody else" from
 * "the title in column four is not a valid string". A bare `400-000` in the results table told
 * the operator nothing, which is how the empty-title bug above stayed hidden.
 */
function refusal(error: unknown): string {
  if (!(error instanceof ApiError)) return "unknown";
  return error.message !== "" ? error.message : error.code;
}

/**
 * Is each identifier free, or does it already belong to somebody else?
 *
 * `GET /v1/users/external-login/{service}/{externalId}` answers 404 when nobody holds it, which
 * is the ordinary case and not an error. A hit on the *same* person is fine too -- that is a row
 * being re-imported.
 */
async function checkIdentifiers(
  email: string,
  externalIds: Record<string, string>,
): Promise<Pick<ImportOutcome, "identifiersFailed">> {
  const identifiersFailed: { service: string; code: string; owner?: string }[] = [];

  for (const [service, externalId] of Object.entries(externalIds)) {
    try {
      const owner = await apiRead<{ privateData?: { email?: string } | null }>(
        "/v1/users/external-login/{service}/{externalId}",
        { pathParams: { service, externalId } },
      );
      const ownerEmail = owner.privateData?.email ?? "";
      if (ownerEmail.toLowerCase() !== email.toLowerCase()) {
        identifiersFailed.push({ service, code: "taken", owner: ownerEmail });
      }
    } catch (error) {
      // 404 is "nobody holds it", which is what we were hoping for.
      if (error instanceof ApiError && error.httpStatus === 404) continue;
      identifiersFailed.push({ service, code: identifierFailure(error) });
    }
  }

  return { identifiersFailed };
}

async function importRow(
  row: RosterRow,
  instanceId: string,
  gates: GroupGate[],
  locale: string,
  invite: boolean,
): Promise<ImportOutcome> {
  const base: ImportOutcome = {
    email: row.email,
    state: "failed",
    identifiersSet: [],
    identifiersFailed: [],
  };

  // Whether the directory can be read at all depends on the reader's instance role, not on the
  // group: `user.viewAll` starts at `supervisor`, while `group.inviteStudents` reaches down to
  // `supervisor-student`. Somebody in that gap may legitimately open this screen and still be
  // refused the search, and then existing and new accounts simply cannot be told apart -- so the
  // invitation is attempted and core-api's "email already taken" becomes the answer.
  let existingId: string | null = null;
  let directoryReadable = true;
  try {
    existingId = await findByEmail(row.email);
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) {
      directoryReadable = false;
    } else {
      return { ...base, reason: refusal(error) };
    }
  }

  if (existingId !== null) {
    const userId = existingId;
    const joining = gates.filter((gate) => !gate.students.has(userId));
    try {
      for (const gate of joining) {
        await apiPost("/v1/groups/{id}/students/{userId}", undefined, {
          pathParams: { id: gate.id, userId },
        });
      }
    } catch (error) {
      return {
        ...base,
        reason: refusal(error),
        ...(await writeIdentifiers(userId, row.externalIds)),
      };
    }

    return {
      ...base,
      state: joining.length > 0 ? "added" : "matched",
      ...(await writeIdentifiers(userId, row.externalIds)),
    };
  }

  // A dry run stops here for anybody without an account -- but it still says whether their
  // identifiers are free, which is the whole reason to do a dry run before sending a hundred
  // invitations that one clash would make core-api refuse.
  if (!invite) {
    return { ...base, state: "skipped", ...(await checkIdentifiers(row.email, row.externalIds)) };
  }

  try {
    await apiPost("/v1/users/invite", {
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      // **Omitted when empty, never sent as `""`.** Both title fields are optional but declared
      // `VString(1)`, so an empty string is not "no title", it is a string that fails validation
      // -- and the refusal names `titlesAfterName`, which reads like a wrong value rather than a
      // missing column. Found live, on a table with no "titul za" column at all.
      ...(row.titlesBeforeName !== "" && { titlesBeforeName: row.titlesBeforeName }),
      ...(row.titlesAfterName !== "" && { titlesAfterName: row.titlesAfterName }),
      instanceId,
      groups: gates.map((gate) => gate.id),
      locale,
      ...(Object.keys(row.externalIds).length > 0 && { externalIds: row.externalIds }),
      // Two people of the same name is ordinary in a cohort, and core-api answers a collision by
      // returning the colliding users instead of inviting. The import has a list, not a reader to
      // ask, so it says up front that a namesake is fine.
      ignoreNameCollision: true,
    });
  } catch (error) {
    // The one refusal worth translating: it means the person exists and this reader could not
    // look them up, so somebody with the directory has to add them by hand.
    if (!directoryReadable && error instanceof ApiError && error.code === "400-110") {
      return { ...base, reasonCode: "emailTaken" };
    }
    return { ...base, reason: refusal(error) };
  }

  return {
    ...base,
    state: "invited",
    identifiersSet: Object.keys(row.externalIds),
  };
}

export async function importRoster(
  rows: RosterRow[],
  options: { groups: string[]; locale: string; invite: boolean },
): Promise<{ outcomes: ImportOutcome[]; refused?: "notAllowed" }> {
  const [viewer, gates] = await Promise.all([
    getCurrentUser(),
    Promise.all(options.groups.map(readGroupGate)),
  ]);

  // The screen is gated on the same hint, so reaching this is either a stale page or a forged
  // call. core-api would refuse every row anyway; refusing once is the readable version.
  if (gates.some((gate) => !gate.canInvite)) return { outcomes: [], refused: "notAllowed" };

  const instanceId = viewer.instanceIds[0] ?? "";
  const capped = rows.slice(0, MAX_ROWS);
  const outcomes: ImportOutcome[] = new Array<ImportOutcome>(capped.length);

  let next = 0;
  async function worker() {
    for (let index = next++; index < capped.length; index = next++) {
      outcomes[index] = await importRow(
        capped[index]!,
        instanceId,
        gates,
        options.locale,
        options.invite,
      );
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { outcomes };
}
