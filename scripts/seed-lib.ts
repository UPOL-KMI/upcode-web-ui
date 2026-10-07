/**
 * The pieces of `seed.ts` another seeding script reuses (X-032): the API client, users, groups,
 * the one base exercise, assignments and solutions. Moved out unchanged so `pnpm seed` behaves
 * exactly as before; see that file for the spec they implement.
 */
export const API_BASE = process.env.API_BASE_INTERNAL ?? process.env.API_BASE_PUBLIC;
if (!API_BASE) {
  throw new Error("API_BASE_INTERNAL or API_BASE_PUBLIC must be set (see .env.local).");
}

export const SEED_PREFIX = "[seed]";
// Not a secret -- disposable test data on a disposable instance, see docs/SEED_ACCOUNTS.md.
export const SEED_PASSWORD = "RecodexSeed123!";
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@admin.com";
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin";
export const FILLER_COUNT = 25; // comfortably past any plausible page size, for pagination states

// ---------------------------------------------------------------------------
// Minimal API client -- only the fields this script actually reads are typed.
// ---------------------------------------------------------------------------

export class ApiError extends Error {}

export async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new ApiError(
      `${method} ${path} -> ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json.payload as T;
}

export async function apiUpload(
  token: string,
  path: string,
  filename: string,
  content: string | Uint8Array<ArrayBuffer>,
  mimeType = "text/plain",
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: mimeType }), filename);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new ApiError(
      `POST ${path} (upload) -> ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`,
    );
  }
  return json.payload as { id: string };
}

export function log(msg: string) {
  console.log(`${SEED_PREFIX} ${msg}`);
}

// ---------------------------------------------------------------------------
// Auth / users
// ---------------------------------------------------------------------------

export interface AuthResult {
  token: string;
  userId: string;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const payload = await api<{ accessToken: string; user: { id: string } }>("POST", "/login", {
    body: { username: email, password },
  });
  return { token: payload.accessToken, userId: payload.user.id };
}

export interface SeedUserSpec {
  email: string;
  firstName: string;
  lastName: string;
  role?: "student" | "supervisor-student" | "supervisor" | "empowered-supervisor" | "superadmin";
}

/** Login if the account already exists (idempotent path), else register it fresh. */
export class WrongInstanceError extends Error {}

/**
 * Stops if an account this run means to reuse belongs to a different instance.
 *
 * **An address is unique deployment-wide and an account belongs to exactly one instance**, so
 * looking a seed account up by email can hand back one created against another instance -- which
 * is what an earlier run, before `chooseInstance`, actually did. The failure that follows is quiet
 * and misleading rather than loud: the group lists the student, `POST /users/list` discloses only
 * the ones the caller may see, and the roster renders the rest as a raw UUID. Four specs failed on
 * a screen that was behaving correctly.
 *
 * Nothing here can repair it -- core-api offers no way to move a user between instances and the
 * address cannot be registered twice -- so this reports what to do rather than trying.
 */
export async function assertUserIsOnInstance(
  adminToken: string,
  userId: string,
  instanceId: string,
  email: string,
): Promise<void> {
  const user = await api<{ privateData?: { instancesIds?: string[] } }>("GET", `/users/${userId}`, {
    token: adminToken,
  });
  const belongsTo = user.privateData?.instancesIds ?? [];
  if (belongsTo.includes(instanceId)) return;
  throw new WrongInstanceError(
    `${email} already exists on instance ${belongsTo.join(", ") || "(none)"}, but this run seeds ` +
      `${instanceId}. An address cannot be registered twice and core-api cannot move a user ` +
      `between instances, so either delete that account (its solutions go with it) or point the ` +
      `seed at the other instance with SEED_INSTANCE_ID=${belongsTo[0] ?? "<id>"}.`,
  );
}

export async function getOrCreateUser(
  adminToken: string,
  instanceId: string,
  spec: SeedUserSpec,
): Promise<AuthResult> {
  try {
    const existing = await login(spec.email, SEED_PASSWORD);
    await assertUserIsOnInstance(adminToken, existing.userId, instanceId, spec.email);
    log(`user exists, reused: ${spec.email}`);
    return existing;
  } catch (error) {
    // A wrong instance is a stop, not a "does not exist": re-registering the address is refused
    // (it is unique deployment-wide) and re-running the seed cannot fix it either.
    if (error instanceof WrongInstanceError) throw error;
    // Not found / wrong credentials -- assume it doesn't exist yet and register it.
  }

  // LOCAL_REGISTRATION_ENABLED=false on this deployment (deliberate operator choice) means
  // this endpoint 403s for an unauthenticated caller -- it must be called as a privileged
  // (superadmin) user, see App\V1Module\Presenters\RegistrationPresenter::checkCreateAccount.
  const created = await api<{ user: { id: string } | null; accessToken: string }>(
    "POST",
    "/users",
    {
      token: adminToken,
      body: {
        email: spec.email,
        firstName: spec.firstName,
        lastName: spec.lastName,
        password: SEED_PASSWORD,
        passwordConfirm: SEED_PASSWORD,
        instanceId,
        ignoreNameCollision: true,
      },
    },
  );
  if (!created.user) {
    throw new Error(
      `Registration of ${spec.email} returned no user (unexpected name collision response).`,
    );
  }
  log(`user created: ${spec.email}`);
  return { token: created.accessToken, userId: created.user.id };
}

export async function ensureGlobalRole(
  adminToken: string,
  userId: string,
  role: SeedUserSpec["role"],
) {
  if (!role || role === "student") return; // "student" is the API's own default for new accounts
  const detail = await api<{ privateData: { role: string } }>("GET", `/users/${userId}`, {
    token: adminToken,
  });
  if (detail.privateData.role === role) return;
  await api("POST", `/users/${userId}/role`, { token: adminToken, body: { role } });
  log(`role set: ${userId} -> ${role}`);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupRecord {
  id: string;
  archived: boolean;
  localizedTexts: { locale: string; name: string }[];
  privateData: { admins: string[]; supervisors: string[]; students: string[] };
}

export async function findGroupByName(
  adminToken: string,
  instanceId: string,
  name: string,
): Promise<GroupRecord | null> {
  const results = await api<GroupRecord[]>(
    "GET",
    `/groups?instanceId=${instanceId}&search=${encodeURIComponent(name)}&archived=true`,
    { token: adminToken },
  );
  return results.find((g) => g.localizedTexts.some((t) => t.name === name)) ?? null;
}

export async function getOrCreateGroup(
  adminToken: string,
  instanceId: string,
  opts: { name: string; parentGroupId?: string },
): Promise<GroupRecord> {
  const existing = await findGroupByName(adminToken, instanceId, opts.name);
  if (existing) {
    log(`group exists, reused: ${opts.name}`);
    return existing;
  }

  const created = await api<GroupRecord>("POST", "/groups", {
    token: adminToken,
    body: {
      instanceId,
      parentGroupId: opts.parentGroupId,
      localizedTexts: [{ locale: "en", name: opts.name, description: "" }],
      publicStats: true,
    },
  });
  log(`group created: ${opts.name}`);
  return created;
}

/**
 * Archive as the LAST step for a group, never at creation time: the API's `becomeMember`
 * permission (both student and non-student membership) requires `group.isNotArchived`, so
 * archiving before adding members would make this script unable to seed a populated,
 * retired-looking course -- see docs/DECISIONS.md.
 */
/**
 * Organizational groups hold other groups and carry no assignments of their own -- a real ReCodEx
 * concept that no seeded group exercised, so the badge for it and the "this group holds no
 * assignments" state had never been seen with data (F-029). core-api refuses the flag once a group
 * has students or assignments, so this only ever runs on a group created for the purpose.
 */
export async function ensureOrganizational(adminToken: string, group: GroupRecord) {
  const detail = await api<{ organizational: boolean }>("GET", `/groups/${group.id}`, {
    token: adminToken,
  });
  if (detail.organizational) {
    log(`group already organizational, skipping (${group.id})`);
    return;
  }
  await api("POST", `/groups/${group.id}/organizational`, {
    token: adminToken,
    body: { value: true },
  });
  log(`group marked organizational: ${group.id}`);
}

export async function ensureArchived(adminToken: string, group: GroupRecord) {
  if (group.archived) return;
  await api("POST", `/groups/${group.id}/archived`, { token: adminToken, body: { value: true } });
  group.archived = true;
  log(`group archived: ${group.localizedTexts[0]?.name ?? group.id}`);
}

/**
 * A group anyone in the instance may walk into (S-026). No seeded group was public and unjoined,
 * so the Join control -- and the only path a student has into a group without an invitation -- had
 * never been rendered. `isPublic` is part of the group's own settings, and core-api replaces the
 * whole group with what it is sent, so the existing texts have to go back with it.
 */
export async function ensurePublic(adminToken: string, group: GroupRecord) {
  const detail = await api<{
    public: boolean;
    externalId: string;
    localizedTexts: { locale: string; name: string; description: string }[];
  }>("GET", `/groups/${group.id}`, { token: adminToken });
  if (detail.public) return false;

  // `actionUpdateGroup` replaces the whole group with what it is sent -- every field it reads has
  // to be present, or the ones left out are cleared (and `externalId` missing is a 500, not a 400).
  await api("POST", `/groups/${group.id}`, {
    token: adminToken,
    body: {
      localizedTexts: detail.localizedTexts.map((text) => ({
        locale: text.locale,
        name: text.name,
        description: text.description,
      })),
      externalId: detail.externalId ?? "",
      isPublic: true,
      publicStats: true,
      detaining: false,
    },
  });
  return true;
}

export async function ensureStudentMember(adminToken: string, group: GroupRecord, userId: string) {
  if (group.privateData.students.includes(userId)) return;
  await api("POST", `/groups/${group.id}/students/${userId}`, { token: adminToken });
  group.privateData.students.push(userId);
}

export async function ensureGroupMember(
  adminToken: string,
  group: GroupRecord,
  userId: string,
  type: "admin" | "supervisor" | "observer",
) {
  const already = type === "admin" ? group.privateData.admins : group.privateData.supervisors;
  if (already.includes(userId)) return;
  await api("POST", `/groups/${group.id}/members/${userId}`, { token: adminToken, body: { type } });
  already.push(userId);
}

// ---------------------------------------------------------------------------
// The one base exercise every assignment in this seed reuses -- see
// docs/DECISIONS.md for why a single hand-verified exercise, reused via many
// assignments, replaces "one exercise per assignment" for the pagination filler.
// ---------------------------------------------------------------------------

export const EXERCISE_NAME = `${SEED_PREFIX} Echo Greeting`;
export const EXPECTED_OUTPUT = "Hello, ReCodEx!\n";
// The python3 stdout pipeline is looked up by name at run time -- see findPipelineId() below.
// It used to be a hardcoded UUID, "verified live" against the instance this script was written
// against. That verification was real and the value was still wrong everywhere else: core-api
// assigns pipeline ids **when the runtime package is imported**, so every fresh database gets
// different ones, and the constant broke the moment the stack was stood up on another machine --
// precisely the one-command bootstrap DEC-052 was asked for.
export const PYTHON_STDOUT_PIPELINE_NAME = "Python execution & evaluation [stdout]";
export const PYTHON_COMPILATION_PIPELINE_NAME = "Compilation source files pass-through";
/** What an exercise config writes into `entry-point` to mean "the submitter names the file". */
export const ENTRY_POINT_SENTINEL = "$entry-point";

export const TEST_NAME = "Test 1";
export const HW_GROUP_ID = "01-default"; // matches WORKER_HWGROUP in the compose repo's .env

/**
 * The `solutionParams` every submission to the seeded exercise has to carry.
 *
 * Its config binds `entry-point` to the sentinel, which makes the entry point a *submit-time*
 * variable: without this core-api refuses the submission outright ("Variable 'entry-point' was not
 * provided on submit").
 *
 * **The file started is the first one listed, not the first by name.** S-014's form defaults to
 * the first by sort order and then makes the reader confirm it whenever a solution has more than
 * one file -- which is the right behaviour for someone who has just dragged files in, and the
 * wrong rule for a fixture: `greeting.py` sorts before `main.py`, so deriving it would seed a
 * solution that imports the program and never runs it. Found exactly that way, as a seeded
 * solution scoring zero.
 */
export function entryPointParams(files: { name: string }[]) {
  return { variables: [{ name: "entry-point", value: files[0]!.name }] };
}

export interface ExerciseRecord {
  id: string;
}

export async function findExerciseByName(
  adminToken: string,
  name: string,
): Promise<ExerciseRecord | null> {
  // `filters[archived]=all` is not optional here: the default list **excludes archived
  // exercises**, so without it a lookup by name cannot see one -- and this function's caller
  // would create a second copy of it on every run. Found exactly that way (T-020's archived
  // catalog fixture was duplicated once before this line was written).
  const results = await api<{ items: { name: string; id: string }[] }>(
    "GET",
    "/exercises?limit=1000&filters%5Barchived%5D=all",
    {
      token: adminToken,
    },
  );
  const match = results.items.find((e) => e.name === name);
  return match ? { id: match.id } : null;
}

export interface PipelineRecord {
  id: string;
  name: string;
  runtimeEnvironmentIds?: string[];
}

/**
 * Resolves a pipeline id by name and runtime environment. `/v1/pipelines` returns a paginated
 * envelope (`{items, ...}`), unlike some sibling list endpoints that return a bare array -- both
 * shapes are accepted here rather than assumed, since that inconsistency has already caught this
 * project once (see the command palette's search route).
 */
export async function findPipelineId(
  adminToken: string,
  name: string,
  runtimeEnvironmentId: string,
): Promise<string> {
  const payload = await api<PipelineRecord[] | { items?: PipelineRecord[] }>("GET", "/pipelines", {
    token: adminToken,
  });
  const pipelines = Array.isArray(payload) ? payload : (payload.items ?? []);
  const match = pipelines.find(
    (pipeline) =>
      pipeline.name === name &&
      (pipeline.runtimeEnvironmentIds ?? []).includes(runtimeEnvironmentId),
  );

  if (!match) {
    throw new Error(
      `Pipeline "${name}" for runtime "${runtimeEnvironmentId}" not found. The runtime package is ` +
        `probably not imported on this instance -- see the compose repo's README, "Language toolchains".`,
    );
  }
  return match.id;
}

/**
 * Exercises whose only job is to be *found* (T-020).
 *
 * The catalog is a search-and-filter screen and this instance held exactly one exercise, which
 * proves nothing about either. These are deliberately **unconfigured**: created with core-api's
 * defaults and left that way, so each is `isBroken`, has no reference solution and cannot be
 * assigned -- which is a real state a catalog has to render, and the same state a half-written
 * exercise is in. One is archived, some carry tags, and the difficulties vary, so every filter on
 * the screen has something to filter by.
 *
 * Idempotent like everything else here: matched by name before creating, and the properties are
 * rewritten each run (a `POST /exercises/{id}` replaces, it does not merge).
 */
export const CATALOG_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const CATALOG_FILLERS: {
  suffix: string;
  difficulty: string;
  tags: string[];
  archived: boolean;
}[] = [
  { suffix: "Binary Search", difficulty: "easy", tags: ["seed-algorithms"], archived: false },
  { suffix: "Merge Sort", difficulty: "medium", tags: ["seed-algorithms"], archived: false },
  {
    suffix: "Graph Colouring",
    difficulty: "hard",
    tags: ["seed-algorithms", "seed-graphs"],
    archived: false,
  },
  { suffix: "String Reversal", difficulty: "easy", tags: [], archived: false },
  { suffix: "Matrix Multiplication", difficulty: "medium", tags: ["seed-graphs"], archived: false },
  { suffix: "Retired Puzzle", difficulty: "hard", tags: [], archived: true },
  // Bulk, so the catalog is more than one page: the same reason FILLER_COUNT exists above.
  ...Array.from({ length: 18 }, (_, index) => ({
    suffix: `Catalog Filler ${String(index + 1).padStart(2, "0")}`,
    difficulty: CATALOG_DIFFICULTIES[index % CATALOG_DIFFICULTIES.length]!,
    tags: [] as string[],
    archived: false,
  })),
];

/**
 * Two exercises **authored by somebody other than the administrator**, so the catalog has a second
 * author to filter by (G-018's "only mine").
 *
 * **This fixture existed by accident until 2026-09-10 and nobody knew.** `exercise-catalog.spec.ts`
 * asserts that filtering to one author gives a total larger than zero and smaller than everything,
 * and its own comment says "the seed splits the catalog cleanly between two authors" -- which the
 * seed did not do. What it was actually reading were exercises left behind by failed
 * `exercise-edit` runs, all named "Exercise by Sam Supervisor" because that is what core-api calls
 * a fresh one. PF-007 stopped those being created; deleting the ones already there took the
 * fixture with them. So the seed now makes what the spec always claimed it made.
 *
 * Created as the supervisor rather than assigned to them afterwards: core-api sets `authorId` from
 * whoever calls `POST /exercises` and there is no endpoint that changes it. They are left
 * unconfigured, like the catalog fillers -- an exercise nobody can assign still counts in a
 * catalog, which is the whole of what this fixture is for.
 */
export async function ensureAuthoredExercises(
  supervisorToken: string,
  ownerGroupId: string,
): Promise<number> {
  let created = 0;

  for (const suffix of ["Supervisor's Draft", "Supervisor's Second Draft"]) {
    const name = `${SEED_PREFIX} ${suffix}`;
    if (await findExerciseByName(supervisorToken, name)) continue;

    const { id } = await api<{ id: string }>("POST", "/exercises", {
      token: supervisorToken,
      body: { groupId: ownerGroupId },
    });
    const current = await api<{ version: number }>("GET", `/exercises/${id}`, {
      token: supervisorToken,
    });
    await api("POST", `/exercises/${id}`, {
      token: supervisorToken,
      body: {
        version: current.version,
        difficulty: "medium",
        localizedTexts: [
          {
            locale: "en",
            name,
            text: "A catalog fixture with an author of its own. Nothing is configured here.",
            link: "",
            description: "",
          },
        ],
        isPublic: true,
        isLocked: false,
        mergeJudgeLogs: true,
        solutionFilesLimit: 5,
        solutionSizeLimit: 65536,
      },
    });
    created++;
  }

  return created;
}

export async function ensureCatalogExercises(
  adminToken: string,
  ownerGroupId: string,
): Promise<number> {
  let created = 0;

  for (const filler of CATALOG_FILLERS) {
    const name = `${SEED_PREFIX} ${filler.suffix}`;
    const existing = await findExerciseByName(adminToken, name);
    const id =
      existing?.id ??
      (
        await api<{ id: string }>("POST", "/exercises", {
          token: adminToken,
          body: { groupId: ownerGroupId },
        })
      ).id;
    if (!existing) created++;

    const current = await api<{ version: number; tags: string[]; archivedAt: number | null }>(
      "GET",
      `/exercises/${id}`,
      { token: adminToken },
    );

    await api("POST", `/exercises/${id}`, {
      token: adminToken,
      body: {
        version: current.version,
        difficulty: filler.difficulty,
        localizedTexts: [
          {
            locale: "en",
            name,
            text: `A catalog fixture. Nothing is configured here, so it cannot be assigned.`,
            link: "",
            description: "",
          },
        ],
        solutionFilesLimit: 5,
        solutionSizeLimit: 65536,
        mergeJudgeLogs: true,
        isPublic: true,
        isLocked: false,
      },
    });

    for (const tag of filler.tags) {
      if (!current.tags.includes(tag)) {
        await api("POST", `/exercises/${id}/tags/${tag}`, { token: adminToken });
      }
    }

    if ((current.archivedAt !== null) !== filler.archived) {
      await api("POST", `/exercises/${id}/archived`, {
        token: adminToken,
        body: { archived: filler.archived },
      });
    }
  }

  return created;
}

export async function getOrCreateBaseExercise(
  adminToken: string,
  ownerGroupId: string,
): Promise<ExerciseRecord> {
  // Reusing an existing exercise by name is *not* the same as it being usable. A run that dies
  // partway (as one did, on the hardcoded pipeline id above) leaves an exercise that exists,
  // matches by name, and is rejected by core-api as "broken" the moment anything tries to assign
  // it. So the configuration steps below run every time, for a reused exercise as much as a fresh
  // one -- they are all idempotent writes that replace rather than append. Only the creation
  // itself is conditional.
  const existing = await findExerciseByName(adminToken, EXERCISE_NAME);
  if (existing) {
    log(`exercise exists, reconfiguring: ${EXERCISE_NAME}`);
  }

  // **Reused by name, and the name says nothing about which group it hangs in.** An earlier run,
  // before `chooseInstance`, created this exercise inside an operator's own course; every run
  // since found it by name and reconfigured it there, so the seeded group never had it. An
  // exercise's groups are what a course may assign *from*, so the group picker offered nothing
  // and two specs failed on a fixture that looked present -- core-api's own search finds it, and
  // scoping to the group does not. Attached rather than moved: a stray attachment in someone
  // else's course is theirs to remove, and detaching would write to their group (PF-013).
  if (existing) {
    const detail = await api<{ groupsIds?: string[] }>("GET", `/exercises/${existing.id}`, {
      token: adminToken,
    });
    const groups = detail.groupsIds ?? [];
    if (!groups.includes(ownerGroupId)) {
      await api("POST", `/exercises/${existing.id}/groups/${ownerGroupId}`, { token: adminToken });
      log(`attached the exercise to the seeded group (it hung only in ${groups.join(", ")})`);
    }
    const strays = groups.filter((one) => one !== ownerGroupId);
    if (strays.length > 0) {
      log(`NOTE: the exercise is also attached to ${strays.join(", ")} -- left alone, see PF-013`);
    }
  }

  const id =
    existing?.id ??
    (
      await api<{ id: string }>("POST", "/exercises", {
        token: adminToken,
        body: { groupId: ownerGroupId },
      })
    ).id;

  await api("POST", `/exercises/${id}/hardware-groups`, {
    token: adminToken,
    body: { hwGroups: [HW_GROUP_ID] },
  });
  // The environment config is what declares **which uploaded files are the solution**, and it is
  // not optional decoration: `ExerciseConfigHelper::getEnvironmentsForFiles()` -- the whole of
  // `POST /pre-submit` -- looks for a *file* variable here, wildcard-matches the submitted file
  // names against its values, and reports an environment as suitable only if every uploaded file
  // was matched by one. With an empty table it matches nothing, so `pre-submit` answered
  // `environments: []` for a perfectly good `solution.py` and the submit form had nothing to
  // offer. The seed's own submissions never noticed, because they pass `runtimeEnvironmentId`
  // directly and skip pre-submit entirely; S-014 is the first thing to go through the real path.
  await api("POST", `/exercises/${id}/environment-configs`, {
    token: adminToken,
    body: {
      environmentConfigs: [
        {
          runtimeEnvironmentId: "python3",
          // **The wildcard is a scalar, not a one-element array, and the difference decides
          // whether anything is ever graded.** `VariablesResolver::resolveFileInputsRegexp`
          // returns the variable untouched when `isValueArray()` is true, so `["*.py"]` is carried
          // into the job verbatim and the compiled task reads
          // `cp ${SOURCE_DIR}/*.py ${SOURCE_DIR}/Test 1/*.py` -- a file literally named `*.py`.
          // Written as `"*.py"` it is matched against the submitted file names and expands to
          // them. This is the shape ReCodEx's own python3 runtime declares in `defaultVariables`.
          variablesTable: [{ name: "source-files", type: "file[]", value: "*.py" }],
        },
      ],
    },
  });

  // `POST /tests` *adds* rather than replaces: re-running it with the same name fails with
  // "given test name 'Test 1' is already taken". Sending the existing test's id turns the same
  // call into an update, which is what makes re-running this script safe on an instance that
  // already has the exercise.
  const existingTests = await api<{ id: number; name: string }[]>("GET", `/exercises/${id}/tests`, {
    token: adminToken,
  });
  const existingTest = existingTests.find((candidate) => candidate.name === TEST_NAME);

  const test = await api<{ id: number }[]>("POST", `/exercises/${id}/tests`, {
    token: adminToken,
    body: {
      tests: [existingTest ? { id: existingTest.id, name: TEST_NAME } : { name: TEST_NAME }],
    },
  });
  const firstTest = test[0];
  if (!firstTest) throw new Error("POST /exercises/{id}/tests returned no test.");
  const testId = firstTest.id;

  // core-api guards exercise edits with optimistic concurrency: the payload must carry the
  // exercise's *current* version, and a hardcoded 1 only works on an exercise nobody has touched.
  // Every re-run of this script bumps it, so read it back rather than assuming.
  const current = await api<{ version: number }>("GET", `/exercises/${id}`, { token: adminToken });

  await api("POST", `/exercises/${id}`, {
    token: adminToken,
    body: {
      version: current.version,
      difficulty: "easy",
      localizedTexts: [
        {
          locale: "en",
          name: EXERCISE_NAME,
          text: `Read a line and print exactly: ${EXPECTED_OUTPUT.trim()}`,
          link: "",
          description: "",
        },
      ],
      solutionFilesLimit: 5,
      solutionSizeLimit: 65536,
      mergeJudgeLogs: true,
      isPublic: true,
      isLocked: false,
    },
  });

  const expectedUpload = await apiUpload(
    adminToken,
    "/uploaded-files",
    "expected.txt",
    EXPECTED_OUTPUT,
  );
  await api("POST", `/exercises/${id}/files`, {
    token: adminToken,
    body: { files: [expectedUpload.id] },
  });

  // **A test needs both of the environment's pipelines, compilation first.** The execution
  // pipeline's `source-files` is an *input* it expects a preceding pipeline to bind; on its own it
  // is bound to nothing, and the submitted file never reaches the sandbox under its real name.
  // Python compiles nothing, so its "compilation" is a pass-through -- which is why leaving it out
  // looked harmless and was not. This is the order core-api's own executor reads them in, and the
  // same pair `lib/exercise-config/simple-config.ts` writes from the exercise editor.
  const compilationPipelineId = await findPipelineId(
    adminToken,
    PYTHON_COMPILATION_PIPELINE_NAME,
    "python3",
  );
  const executionPipelineId = await findPipelineId(
    adminToken,
    PYTHON_STDOUT_PIPELINE_NAME,
    "python3",
  );

  const variables = await api<
    { id: string; variables: { name: string; type: string; value: unknown }[] }[]
  >("POST", `/exercises/${id}/config/variables`, {
    token: adminToken,
    body: {
      runtimeEnvironmentId: "python3",
      pipelinesIds: [compilationPipelineId, executionPipelineId],
    },
  });
  const declared = new Map(variables.map((entry) => [entry.id, entry.variables] as const));
  const executionVariables = declared.get(executionPipelineId);
  if (!executionVariables)
    throw new Error("POST /exercises/{id}/config/variables returned no variable set.");
  const varMap = new Map(executionVariables.map((v) => [v.name, v] as const));
  varMap.set("expected-output", { ...varMap.get("expected-output")!, value: "expected.txt" });
  varMap.set("judge-type", { ...varMap.get("judge-type")!, value: "recodex-judge-normal" });
  varMap.set("success-exit-codes", { ...varMap.get("success-exit-codes")!, value: ["0"] });
  // **`$entry-point` is a reference, not a literal, and an empty string is not "no entry point".**
  // Left empty the compiled job runs `python3 <runner> ${EVAL_DIR}/` with nothing to run; the
  // sentinel makes it a submit-time variable, which every submission then has to name a file for
  // (`solutionParams`, as `submitSolutionWithEntryPoint` below and S-014's form both do).
  varMap.set("entry-point", { ...varMap.get("entry-point")!, value: ENTRY_POINT_SENTINEL });

  await api("POST", `/exercises/${id}/config`, {
    token: adminToken,
    body: {
      config: [
        {
          name: "python3",
          tests: [
            {
              name: testId,
              pipelines: [
                {
                  name: compilationPipelineId,
                  variables: declared.get(compilationPipelineId) ?? [],
                },
                { name: executionPipelineId, variables: Array.from(varMap.values()) },
              ],
            },
          ],
        },
      ],
    },
  });

  await api("POST", `/exercises/${id}/limits`, {
    token: adminToken,
    body: {
      limits: { [HW_GROUP_ID]: { python3: { [testId]: { memory: 65536, "wall-time": 5 } } } },
    },
  });

  // Every other write above replaces; this one *appends*, so it needs its own guard. Without it
  // each run added another reference solution to the same exercise -- harmless individually, and
  // a steadily growing list on any machine where the seed is re-run often. Found by re-running it
  // four times while building F-029's fixtures.
  const referenceNote = `${SEED_PREFIX} reference solution`;
  const references = await api<{ id: string; description: string }[]>(
    "GET",
    `/reference-solutions/exercise/${id}`,
    { token: adminToken },
  );
  const seededReference = references.find((reference) => reference.description === referenceNote);
  if (seededReference) {
    log(`reference solution already exists, skipping submit`);
    // **One run, which is what the seed promises and what a spec asserts.** Evaluating it again is
    // how `reference-solutions.spec.ts` gets a history to read, and it removes the run it added --
    // at the end of the test body, so a failure anywhere before that leaves the solution one run
    // deeper and the next run finds a history where there should be none. The oldest is the
    // seed's; core-api refuses to delete the last one, so there is no way to overshoot.
    const runs = await api<{ id: string; submittedAt: number }[]>(
      "GET",
      `/reference-solutions/${seededReference.id}/submissions`,
      { token: adminToken },
    );
    const extra = [...runs]
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .slice(1)
      .map((run) => run.id);
    for (const runId of extra) {
      await api("DELETE", `/reference-solutions/submission/${runId}`, { token: adminToken });
    }
    if (extra.length > 0) {
      log(`removed ${extra.length} evaluation run(s) left on the reference solution`);
    }
  } else {
    const solutionUpload = await apiUpload(
      adminToken,
      "/uploaded-files",
      "solution.py",
      `print("${EXPECTED_OUTPUT.trim()}")\n`,
    );
    await api("POST", `/reference-solutions/exercise/${id}/submit`, {
      token: adminToken,
      body: {
        note: referenceNote,
        files: [solutionUpload.id],
        runtimeEnvironmentId: "python3",
        solutionParams: entryPointParams([{ name: "solution.py" }]),
      },
    });
    log(`reference solution submitted`);
  }

  log(existing ? `exercise reconfigured: ${EXERCISE_NAME}` : `exercise created: ${EXERCISE_NAME}`);
  return { id };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface AssignmentDetail {
  id: string;
  version: number;
  createdAt: number;
  solutionFilesLimit: number;
  solutionSizeLimit: number;
  localizedTexts?: { studentHint?: string | null }[];
}

/** The student hints of G1's three assignments, in one place because they are search keys as well
 *  as content: `pickByHint` finds an existing assignment by the same string `createAssignment`
 *  gave it. */
export const G1_HINTS = {
  primary: "Print the exact greeting, including the newline.",
  unsubmitted: "Nothing submitted yet -- exercises the empty-submissions UI state.",
  secondDeadline: "Has a second deadline -- worth fewer points after the first one passes.",
} as const;

/**
 * The one of `assignments` whose student hint starts with `hint`.
 *
 * The seed makes three assignments from one exercise on purpose (F-029) and they are otherwise
 * indistinguishable -- an assignment has no name of its own, it displays its exercise's. Picking
 * them out **by position used to be a coin toss**: all three are created inside the same second, so
 * `createdAt` ties and the tiebreak is an arbitrary id comparison. That is what put two solutions
 * noted `[seed] correct` under two different assignments, and sorting the list was never a fix for
 * it. `e2e/helpers/core-api.ts` names them the same way from the other side.
 */
export function pickByHint(
  assignments: AssignmentDetail[],
  hint: string,
): AssignmentDetail | undefined {
  return assignments.find((a) =>
    (a.localizedTexts ?? []).some((text) => (text.studentHint ?? "").startsWith(hint)),
  );
}

export async function createAssignment(
  adminToken: string,
  exerciseId: string,
  groupId: string,
  opts: {
    firstDeadlineDays: number;
    maxPoints: number;
    hint: string;
    /** Days after the first deadline. Set on exactly one seeded assignment (F-029): the "second
     *  chance" deadline state has three UI surfaces (`DeadlineBadge`, the calendar's second-
     *  deadline tone, the assignment screen's second-deadline row) and no data behind any of them
     *  otherwise. */
    secondDeadlineDays?: number;
    secondDeadlineMaxPoints?: number;
    /** Defaults to published; the grading demo (X-032) needs hidden and not-yet-visible ones. */
    isPublic?: boolean;
    isBonus?: boolean;
    visibleFromDays?: number;
  },
): Promise<AssignmentDetail> {
  const created = await api<AssignmentDetail>("POST", "/exercise-assignments", {
    token: adminToken,
    body: { exerciseId, groupId },
  });

  const firstDeadline = Math.floor(Date.now() / 1000) + opts.firstDeadlineDays * 86400;
  const allowSecondDeadline = opts.secondDeadlineDays !== undefined;
  await api("POST", `/exercise-assignments/${created.id}`, {
    token: adminToken,
    body: {
      version: created.version,
      isPublic: opts.isPublic ?? true,
      ...(opts.visibleFromDays !== undefined && {
        visibleFrom: Math.floor(Date.now() / 1000) + opts.visibleFromDays * 86400,
      }),
      localizedStudentHints: { en: opts.hint },
      firstDeadline,
      maxPointsBeforeFirstDeadline: opts.maxPoints,
      submissionsCountLimit: 20,
      solutionFilesLimit: created.solutionFilesLimit,
      solutionSizeLimit: created.solutionSizeLimit,
      allowSecondDeadline,
      ...(allowSecondDeadline
        ? {
            secondDeadline: firstDeadline + opts.secondDeadlineDays! * 86400,
            maxPointsBeforeSecondDeadline: opts.secondDeadlineMaxPoints ?? opts.maxPoints,
          }
        : {}),
      canViewLimitRatios: true,
      canViewMeasuredValues: true,
      canViewJudgeStdout: true,
      canViewJudgeStderr: true,
      maxPointsDeadlineInterpolation: false,
      isBonus: opts.isBonus ?? false,
    },
  });
  log(`assignment created: ${opts.hint}`);
  return created;
}

/**
 * An assignment is a *snapshot* of its exercise, not a live view of it: fixing the exercise's
 * configuration leaves every assignment already made from it on the old copy, and core-api reports
 * the difference in `exerciseSynchronizationInfo`. This matters here because the environment
 * config fix above (the one that makes `pre-submit` able to detect a language at all) is exactly
 * such a change -- without this step it would only ever apply to a database seeded from scratch.
 *
 * Verified that syncing preserves the assignment's own settings: the deadlines, points and the
 * `[seed]` student hint all survive; only the exercise-derived halves (config, environment
 * configs, limits, files) are replaced.
 */
export async function ensureAssignmentSynced(
  adminToken: string,
  assignmentId: string,
): Promise<boolean> {
  const assignment = await api<{
    exerciseSynchronizationInfo: Record<string, unknown>;
  }>("GET", `/exercise-assignments/${assignmentId}`, { token: adminToken });

  const stale = Object.entries(assignment.exerciseSynchronizationInfo).filter(
    ([, value]) =>
      typeof value === "object" &&
      value !== null &&
      (value as { upToDate?: boolean }).upToDate === false,
  );
  if (stale.length === 0) return false;

  await api("POST", `/exercise-assignments/${assignmentId}/sync-exercise`, { token: adminToken });
  return true;
}

/** Existing assignments in a group whose exerciseId matches -- used to make assignment creation idempotent. */
export async function findAssignmentsForExercise(
  adminToken: string,
  group: GroupRecord,
  exerciseId: string,
): Promise<AssignmentDetail[]> {
  const detail = await api<{ privateData: { assignments: string[] } }>(
    "GET",
    `/groups/${group.id}`,
    {
      token: adminToken,
    },
  );
  const result: AssignmentDetail[] = [];
  for (const id of detail.privateData.assignments) {
    const a = await api<AssignmentDetail & { exerciseId: string }>(
      "GET",
      `/exercise-assignments/${id}`,
      {
        token: adminToken,
      },
    );
    if (a.exerciseId === exerciseId) result.push(a);
  }
  // Sorted only so the log reads in creation order. Nothing picks an assignment by position any
  // more -- see `pickByHint` for why that could not work.
  return result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function submitSolution(
  studentToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
  files: { name: string; content: string }[],
) {
  const existing = await api<{ note: string }[]>(
    "GET",
    `/exercise-assignments/${assignmentId}/users/${studentId}/solutions`,
    { token: studentToken },
  );
  if (existing.some((s) => s.note === note)) {
    log(`solution already exists, skipping submit (${note})`);
    return;
  }

  const uploads = await Promise.all(
    files.map((file) => apiUpload(studentToken, "/uploaded-files", file.name, file.content)),
  );
  await api("POST", `/exercise-assignments/${assignmentId}/submit`, {
    token: studentToken,
    body: {
      note,
      files: uploads.map((upload) => upload.id),
      runtimeEnvironmentId: "python3",
      solutionParams: entryPointParams(files),
    },
  });
  log(`submitted: ${note}`);
}

export interface SolutionRecord {
  id: string;
  note: string;
  reviewRequest: boolean;
  review: { startedAt: number; closedAt: number | null; issues: number } | null;
}

/**
 * Removes `[seed] `-noted solutions on G1's three assignments that this run did not intend
 * (PF-012), so the counts the specs assert are facts about the seed rather than about how many
 * times the suite has been run.
 *
 * **Everything it removes was put there by a bug that is now fixed**, and both bugs put it
 * somewhere arbitrary: picking "the primary assignment" by position meant a run's submissions
 * could land on a different one than the last run's, and deleting an account leaves its solutions
 * behind with `authorId: null`. F-029's "nothing submitted yet" fixture had collected two that way
 * and stopped being an empty-state fixture at all.
 *
 * Deliberately narrow. It looks only at these three assignments, and only at notes carrying the
 * seed's own prefix -- a solution a person submitted by hand, or one the e2e suite left behind
 * under its own note, is not this function's business. A delete that core-api refuses is logged
 * and stepped over rather than fatal: an orphan whose author is gone is exactly the case
 * `DELETE /assignment-solutions/{id}` answers 500 to (the family of Q-021), and a seed that cannot
 * finish because of one is worse than a seed that says so.
 */
export async function sweepUnintendedSeedSolutions(
  adminToken: string,
  assignmentIds: string[],
  intended: { assignmentId: string; authorId: string; note: string }[],
): Promise<void> {
  const keep = new Set(
    intended.map((one) => `${one.assignmentId}|${one.authorId}|${SEED_PREFIX} ${one.note}`),
  );
  let removed = 0;
  let refused = 0;
  for (const assignmentId of assignmentIds) {
    const solutions = await api<{ id: string; note: string; authorId: string | null }[]>(
      "GET",
      `/exercise-assignments/${assignmentId}/solutions`,
      { token: adminToken },
    );
    for (const solution of solutions) {
      if (!solution.note.startsWith(`${SEED_PREFIX} `)) continue;
      if (keep.has(`${assignmentId}|${solution.authorId ?? ""}|${solution.note}`)) continue;
      try {
        await api("DELETE", `/assignment-solutions/${solution.id}`, { token: adminToken });
        removed++;
        log(`removed a solution this run did not intend: ${solution.note} (${solution.id})`);
      } catch (error) {
        refused++;
        log(
          `could not remove ${solution.note} (${solution.id}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
  if (removed === 0 && refused === 0) log("no unintended seed solutions to remove");
  if (refused > 0) log(`${refused} unintended solution(s) core-api refused to remove -- see Q-029`);
}

export async function findSolutionByNote(
  token: string,
  assignmentId: string,
  studentId: string,
  note: string,
): Promise<SolutionRecord | null> {
  const solutions = await api<SolutionRecord[]>(
    "GET",
    `/exercise-assignments/${assignmentId}/users/${studentId}/solutions`,
    { token },
  );
  return solutions.find((s) => s.note === note) ?? null;
}

/**
 * A student asking their teacher to look at a solution -- the row the teacher dashboard's
 * "review requests" panel (S-002) is built to show. Set by the student themselves, which is who
 * core-api authorises for this flag (`canSetFlagAsStudent`).
 */
export async function ensureReviewRequested(
  studentToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
) {
  const solution = await findSolutionByNote(studentToken, assignmentId, studentId, note);
  if (!solution) throw new Error(`no solution noted '${note}' to request a review for`);
  if (solution.reviewRequest) {
    log(`review already requested, skipping (${note})`);
    return;
  }
  await api("POST", `/assignment-solutions/${solution.id}/set-flag/reviewRequest`, {
    token: studentToken,
    body: { value: true },
  });
  log(`review requested: ${note}`);
}

/**
 * A review a teacher has opened and not closed -- the row the teacher dashboard's "pending
 * reviews" panel (S-002) is built to show. `close: false` sets `reviewStartedAt` and leaves
 * `reviewedAt` null, which is exactly what `findPendingReviewsOfTeacher` looks for.
 */
export async function ensureReviewOpened(
  teacherToken: string,
  studentId: string,
  assignmentId: string,
  note: string,
) {
  const solution = await findSolutionByNote(teacherToken, assignmentId, studentId, note);
  if (!solution) throw new Error(`no solution noted '${note}' to open a review on`);
  if (solution.review && solution.review.closedAt === null) {
    log(`review already open, skipping (${note})`);
    return;
  }
  await api("POST", `/assignment-solutions/${solution.id}/review`, {
    token: teacherToken,
    body: { close: false },
  });
  log(`review opened: ${note}`);
}
