import "server-only";
import { getTranslations } from "next-intl/server";

import { getGroupInvitation } from "@/lib/api/group-invitation";
import { apiPost } from "@/lib/api/client";
import { apiRead } from "@/lib/api/read";
import { isGuideSlug } from "@/lib/docs/guides";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import type { BreadcrumbItem } from "@/components/page-shell";

interface StaticManifestEntry {
  /** The next-intl namespace whose `title` key holds this segment's label -- the same namespace
   *  every stub page (F-013) already calls `getTranslations()` with. Also this entry's own lookup
   *  key for `resolveBreadcrumbsForNamespace()`. */
  namespace: string;
  /** Full pathname this segment renders at, locale-stripped (e.g. "/forgot-password/change"). */
  pattern: string;
  /** Set where the segment names a section that has no page of its own -- `/assignments` exists
   *  only as the parent of `/assignments/:id` (`docs/IA.md` §2). Its crumb renders as plain text;
   *  linking it would send the user to a route that does not exist and, worse, have Next prefetch
   *  a 404 from every page that shows the crumb. */
  unlinked?: boolean;
  resolve?: never;
}

interface DynamicManifestEntry {
  namespace?: never;
  unlinked?: never;
  /** Path pattern with `:param` segments, e.g. "/groups/:groupId". */
  pattern: string;
  /** Resolves this segment's own label from its matched params -- e.g. fetch a group's name. */
  resolve: (params: Record<string, string>, locale: string) => Promise<string>;
  /**
   * Crumbs that belong **before** this one and are not in the URL.
   *
   * An assignment's address says nothing about the course it was set in, so the trail opened with
   * a generic "Assignments" heading and a reader two clicks deep had no way back to the group.
   * Where this is given, it replaces every crumb derived from the path prefixes above -- the
   * owning group is better context than the section name it stands in for.
   */
  ancestors?: (params: Record<string, string>, locale: string) => Promise<BreadcrumbItem[]>;
}

type ManifestEntry = StaticManifestEntry | DynamicManifestEntry;

/**
 * The one route manifest (brief footgun #12: "Breadcrumbs come from one mechanism... every page
 * renders breadcrumbs through it. No page builds its own."). Covers every currently-real route
 * (`app/[locale]/(anon)/...`, `app/[locale]/(app)/...`, F-013).
 *
 * The three dynamic entries below were added by D-014/D-015, as this file's original note asked
 * ("add a `DynamicManifestEntry` here in whichever ticket builds that route for real"): the
 * sidebar links to groups and the command palette links to groups, exercises and users, and their
 * response shapes are now confirmed against a live instance rather than guessed. Their pages are
 * still route skeletons; the breadcrumb is real. `/assignments/:assignmentId` joined them in
 * S-001, for the same reason: the dashboard links every open assignment, and
 * `/solutions/:solutionId` joined in S-002, whose review queues link every solution waiting on a
 * teacher.
 */
const MANIFEST: ManifestEntry[] = [
  { namespace: "Dashboard", pattern: "/dashboard" },
  { namespace: "Groups", pattern: "/groups" },
  { namespace: "Exercises", pattern: "/exercises" },
  { namespace: "Pipelines", pattern: "/pipelines" },
  { namespace: "Users", pattern: "/users" },
  // Before the dynamic `/users/:userId` further down, which this path would otherwise match:
  // the first entry wins, and "import" is not somebody's id.
  { namespace: "UserImport", pattern: "/users/import" },
  { namespace: "UserEdit", pattern: "/users/:userId/edit" },
  { namespace: "SubmissionFailures", pattern: "/submission-failures" },
  { namespace: "SystemMessages", pattern: "/system-messages" },
  { namespace: "Archive", pattern: "/archive" },
  { namespace: "Admin", pattern: "/admin" },
  { namespace: "Instances", pattern: "/admin/instances" },
  { namespace: "Profile", pattern: "/profile" },
  { namespace: "Login", pattern: "/login" },
  { namespace: "Register", pattern: "/register" },
  { namespace: "ForgotPassword", pattern: "/forgot-password" },
  { namespace: "ForgotPasswordChange", pattern: "/forgot-password/change" },
  { namespace: "EmailVerification", pattern: "/email-verification" },
  { namespace: "AcceptInvitation", pattern: "/accept-invitation" },
  { namespace: "GroupInvitation", pattern: "/accept-group-invitation", unlinked: true },
  { namespace: "Docs", pattern: "/docs" },
  {
    pattern: "/docs/:slug",
    resolve: async (params, locale) => {
      const t = await getTranslations({ locale, namespace: "Docs" });
      return isGuideSlug(params.slug ?? "")
        ? t(`guides.${params.slug}.title`)
        : (params.slug ?? "");
    },
  },
  { namespace: "Account", pattern: "/profile/edit" },
  { namespace: "Assignment", pattern: "/assignments", unlinked: true },
  { namespace: "Solutions", pattern: "/solutions", unlinked: true },
  { namespace: "Shadow", pattern: "/shadow-assignments", unlinked: true },
  // A leaf with a static label under a dynamic parent: `matchPattern` handles the `:param`
  // segment, and the label is this page's own namespace title like any other static entry.
  { namespace: "Submit", pattern: "/assignments/:assignmentId/submit" },
  {
    namespace: "AssignmentSolutions",
    pattern: "/assignments/:assignmentId/solutions",
  },
  { namespace: "AssignmentEdit", pattern: "/assignments/:assignmentId/edit" },
  { namespace: "Shadow.edit", pattern: "/shadow-assignments/:shadowId/edit" },
  { namespace: "ExerciseImport", pattern: "/exercises/import" },
  { namespace: "ExerciseEdit", pattern: "/exercises/:exerciseId/edit" },
  { namespace: "ExerciseConfig", pattern: "/exercises/:exerciseId/edit-config" },
  { namespace: "ExerciseLimits", pattern: "/exercises/:exerciseId/edit-limits" },
  { namespace: "ExerciseAssignments", pattern: "/exercises/:exerciseId/assignments" },
  { namespace: "ReferenceSolutions", pattern: "/exercises/:exerciseId/reference-solutions" },
  { namespace: "PipelineEdit", pattern: "/pipelines/:pipelineId/edit" },
  {
    // A pipeline has a plain `name`, unlike the entities whose labels live in `localizedTexts`.
    pattern: "/pipelines/:pipelineId",
    resolve: async (params) => {
      const pipeline = await apiRead<{ name?: string }>("/v1/pipelines/{id}", {
        pathParams: { id: params.pipelineId! },
      });
      return pipeline.name ?? "";
    },
  },
  {
    // A reference solution's crumb is its description -- the author's own note about what this
    // answer demonstrates -- which is the only thing that distinguishes it from the exercise's
    // other answers. `getReferenceSolution` is not memoized, so this is a second read; the list
    // endpoint would be a larger one.
    pattern: "/exercises/:exerciseId/reference-solutions/:solutionId",
    resolve: async (params, locale) => {
      const [solution, t] = await Promise.all([
        apiRead<{ description?: string }>("/v1/reference-solutions/{solutionId}", {
          pathParams: { solutionId: params.solutionId! },
        }),
        getTranslations({ locale, namespace: "ReferenceSolutions.detail" }),
      ]);
      return solution.description || t("untitled");
    },
  },
  { namespace: "AssignExercise", pattern: "/groups/:groupId/assign" },
  { namespace: "Sources", pattern: "/solutions/:solutionId/sources" },
  { namespace: "Plagiarism", pattern: "/solutions/:solutionId/plagiarisms" },
  // `/assignments/:id/users` is a path segment with no page of its own, like `/assignments`.
  { namespace: "Users", pattern: "/assignments/:assignmentId/users", unlinked: true },
  { namespace: "Users", pattern: "/groups/:groupId/users", unlinked: true },

  // Dynamic segments. Each fetches the entity's own display name -- in a Server Component, so no
  // client-side waterfall (docs/IA.md §3.2). Groups and exercises carry no top-level `name`; their
  // labels live in a `localizedTexts` array, verified live (see lib/i18n-text/localized.ts).
  {
    pattern: "/groups/:groupId",
    resolve: async (params, locale) => {
      const group = await apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/groups/{id}", {
        pathParams: { id: params.groupId! },
      });
      return localizedName(group.localizedTexts, locale);
    },
  },
  {
    pattern: "/exercises/:exerciseId",
    resolve: async (params, locale) => {
      const exercise = await apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/exercises/{id}", {
        pathParams: { id: params.exerciseId! },
      });
      return localizedName(exercise.localizedTexts, locale);
    },
  },
  {
    // A shadow assignment carries its name in `localizedTexts` like every other named entity.
    pattern: "/shadow-assignments/:shadowId",
    resolve: async (params, locale) => {
      const assignment = await apiRead<{ localizedTexts?: LocalizedText[] }>(
        "/v1/shadow-assignments/{id}",
        { pathParams: { id: params.shadowId! } },
      );
      return localizedName(assignment.localizedTexts, locale);
    },
    ancestors: async (params, locale) => {
      const assignment = await apiRead<{ groupId: string }>("/v1/shadow-assignments/{id}", {
        pathParams: { id: params.shadowId! },
      });
      return groupCrumb(assignment.groupId, locale);
    },
  },
  {
    pattern: "/assignments/:assignmentId",
    ancestors: async (params, locale) => {
      const assignment = await apiRead<{ groupId: string }>("/v1/exercise-assignments/{id}", {
        pathParams: { id: params.assignmentId! },
      });
      return groupCrumb(assignment.groupId, locale);
    },
    resolve: async (params, locale) => {
      const assignment = await apiRead<{ localizedTexts?: LocalizedText[] }>(
        "/v1/exercise-assignments/{id}",
        { pathParams: { id: params.assignmentId! } },
      );
      return localizedName(assignment.localizedTexts, locale);
    },
  },
  {
    // A solution has no name of its own. The attempt number is what distinguishes it from the
    // author's other attempts at the same assignment, and is what the legacy UI labels it by.
    pattern: "/solutions/:solutionId",
    // The course and the assignment, not the "Solutions" section: a solution's address names
    // neither, and a reader arriving from a review queue had no way up to the assignment it
    // answers. Both reads are the ones the page itself makes.
    //
    // **And whose attempt it is** (X-031): "Pokus 2" alone left a teacher grading a class not knowing
    // who they were looking at. The crumb links to that student's attempts only for a reader who
    // may open that page -- `viewAssignmentSolutions`, on the assignment this read already makes;
    // to the author it is their own name, as text.
    ancestors: async (params, locale) => {
      const solution = await apiRead<{ assignmentId: string; authorId: string }>(
        "/v1/assignment-solutions/{id}",
        { pathParams: { id: params.solutionId! } },
      );
      const [assignment, people] = await Promise.all([
        apiRead<{
          groupId: string;
          localizedTexts?: LocalizedText[];
          permissionHints?: Record<string, boolean>;
        }>("/v1/exercise-assignments/{id}", { pathParams: { id: solution.assignmentId } }),
        apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
          ids: [solution.authorId],
        }),
      ]);
      const authorName = people[0]?.fullName ?? "";
      return [
        ...(await groupCrumb(assignment.groupId, locale)),
        {
          label: localizedName(assignment.localizedTexts, locale),
          href: `/assignments/${solution.assignmentId}`,
        },
        ...(authorName === ""
          ? []
          : [
              {
                label: authorName,
                href:
                  assignment.permissionHints?.viewAssignmentSolutions === true
                    ? `/assignments/${solution.assignmentId}/users/${solution.authorId}`
                    : undefined,
              },
            ]),
      ];
    },
    resolve: async (params, locale) => {
      const [solution, t] = await Promise.all([
        apiRead<{ attemptIndex?: number }>("/v1/assignment-solutions/{id}", {
          pathParams: { id: params.solutionId! },
        }),
        getTranslations({ locale, namespace: "Solutions" }),
      ]);
      return t("crumb", { attempt: solution.attemptIndex ?? 1 });
    },
  },
  {
    // The group is what the reader is being invited to, so it is the crumb -- not the invitation's
    // own uuid, which names nothing. `getGroupInvitation` is memoized, so this shares the page's
    // own fetch rather than adding one.
    pattern: "/accept-group-invitation/:invitationId",
    resolve: async (params, locale) => {
      const [invitation, t] = await Promise.all([
        getGroupInvitation(params.invitationId!, locale),
        getTranslations({ locale, namespace: "GroupInvitation" }),
      ]);
      return invitation.group.name || t("unnamedGroup");
    },
  },
  {
    pattern: "/admin/instances/:instanceId",
    resolve: async (params) => {
      const instance = await apiRead<{ name?: string }>("/v1/instances/{id}", {
        pathParams: { id: params.instanceId! },
      });
      return instance.name ?? "";
    },
  },
  {
    pattern: "/users/:userId",
    resolve: async (params) => {
      const user = await apiRead<{ fullName?: string }>("/v1/users/{id}", {
        pathParams: { id: params.userId! },
      });
      return user.fullName ?? "";
    },
  },
  {
    pattern: "/assignments/:assignmentId/users/:userId",
    resolve: async (params) => {
      const user = await apiRead<{ fullName?: string }>("/v1/users/{id}", {
        pathParams: { id: params.userId! },
      });
      return user.fullName ?? "";
    },
  },
  {
    // T-005's drill-down. The person is the crumb, the same way they are on the assignment's own
    // per-user page above -- the group is already named by the crumb before it.
    pattern: "/groups/:groupId/users/:userId",
    resolve: async (params) => {
      const user = await apiRead<{ fullName?: string }>("/v1/users/{id}", {
        pathParams: { id: params.userId! },
      });
      return user.fullName ?? "";
    },
  },
];

function getPrefixes(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((_, index) => "/" + segments.slice(0, index + 1).join("/"));
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i]!;
    const pathSegment = pathSegments[i]!;
    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

async function resolveLabel(
  entry: ManifestEntry,
  params: Record<string, string>,
  locale: string,
): Promise<string> {
  if (entry.resolve) {
    return entry.resolve(params, locale);
  }
  const t = await getTranslations({ locale, namespace: entry.namespace });
  return t("title");
}

/**
 * The course an assignment was set in, as a crumb. Both kinds of assignment carry `groupId`, and
 * the group's own name lives in `localizedTexts` like every other named entity here.
 */
async function groupCrumb(groupId: string, locale: string): Promise<BreadcrumbItem[]> {
  const group = await apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/groups/{id}", {
    pathParams: { id: groupId },
  });
  return [{ label: localizedName(group.localizedTexts, locale), href: `/groups/${groupId}` }];
}

/**
 * Resolves the full breadcrumb chain for a locale-stripped pathname (e.g. "/forgot-password/change"
 * -> two crumbs: "Reset password" (linked) then "Change forgotten password" (current page, no
 * link)) by walking every prefix of the path and looking each up in `MANIFEST`. Throws for any
 * unregistered prefix rather than silently rendering a gap -- every real route must register
 * itself here, so a missing entry fails loudly during development instead of shipping a broken
 * breadcrumb.
 */
export async function resolveBreadcrumbs(
  pathname: string,
  locale: string,
): Promise<BreadcrumbItem[]> {
  // Matched first, synchronously and all of it, so an unregistered prefix still fails before any
  // request goes out rather than after some of them have.
  const matched = getPrefixes(pathname).map((prefix) => {
    const entry = MANIFEST.find((candidate) => matchPattern(candidate.pattern, prefix) !== null);
    if (!entry) {
      throw new Error(
        `No breadcrumb manifest entry registered for '${prefix}' (resolving '${pathname}').`,
      );
    }
    return { prefix, entry, params: matchPattern(entry.pattern, prefix)! };
  });

  // `allSettled` rather than `all`, and the rejections re-thrown in **path order** (PF-005).
  // Resolving concurrently means an inner crumb's read is issued even when an outer one is going
  // to be refused, and `Promise.all` would then surface whichever rejected *first* -- so a
  // missing user under a forbidden group could answer 404 where the serial loop answered 403.
  // Path order keeps the outermost refusal winning, which is both the previous behaviour and the
  // more informative answer. The original rejection object is re-thrown untouched, because these
  // are Next's `forbidden()`/`notFound()`/`redirect()` interrupts and they are recognised by
  // identity -- catching one and throwing anything else would swallow it (see `lib/api/read.ts`).
  const settled = await Promise.allSettled(
    matched.map(({ entry, params }) => resolveLabel(entry, params, locale)),
  );
  const failure = settled.find((result) => result.status === "rejected");
  if (failure) throw (failure as PromiseRejectedResult).reason;

  const crumbs = matched.map(({ prefix, entry }, index) => ({
    label: (settled[index] as PromiseFulfilledResult<string>).value,
    href: index === matched.length - 1 || entry.unlinked ? undefined : prefix,
  }));

  // The deepest entry that knows its own ancestors wins, and what it returns stands in for
  // everything above it. Resolved after the labels rather than alongside them, so a refusal on the
  // page's own entity still surfaces first and in path order (PF-005).
  for (let index = matched.length - 1; index >= 0; index -= 1) {
    const { entry, params } = matched[index]!;
    const ancestors = "ancestors" in entry ? entry.ancestors : undefined;
    if (!ancestors) continue;
    return [...(await ancestors(params, locale)), ...crumbs.slice(index)];
  }

  return crumbs;
}

/** Convenience entry point for static pages that already identify themselves by namespace
 *  (`/docs`, `/archive`, `/pipelines`, ...) rather than knowing their own full pathname. */
export async function resolveBreadcrumbsForNamespace(
  namespace: string,
  locale: string,
): Promise<BreadcrumbItem[]> {
  const entry = MANIFEST.find((candidate) => candidate.namespace === namespace);
  if (!entry) {
    throw new Error(`No breadcrumb manifest entry registered for namespace '${namespace}'.`);
  }
  return resolveBreadcrumbs(entry.pattern, locale);
}
