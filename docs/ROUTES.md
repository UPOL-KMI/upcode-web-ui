# ReCodEx New Frontend — Route Mapping (Old → New)

**Status:** Re-derived from the built app, P-006, 2026-09-02
**Date:** 2026-05-11 (recon plan), rewritten 2026-09-02 against the routes that actually exist
**Purpose:** Redirect planning, and telling a reader where a screen went

This file used to be the recon plan. It named several routes that were never built (`/groups/[id]/info`,
`/reference-solutions/[id]`, `/admin/server`, `/[...not-found]`) and missed the one change that
matters most for redirects. It now describes `app/`'s actual route tree, verified against
`next build`'s own route listing.

---

## The three things that break every old link

**1. Every page is under a locale prefix.** `i18n/routing.ts` uses next-intl's default
`localePrefix: "always"` and deliberately does not give either language an unprefixed URL — the
brief asks for Czech and English to be equally first-class, and an unprefixed default quietly makes
one of them the real one. So there is no `/dashboard`; there is `/en/dashboard` and `/cs/dashboard`.
A bare path is redirected by `proxy.ts` to whichever locale it negotiates.

Everything in the tables below is written **without** the prefix. Prepend `/{locale}/` to every New
Route, or `/{URL_PATH_PREFIX}/{locale}/` when the app is deployed under a path prefix.

**2. Several legacy screens are now tabs, not routes.** The group screen is the big one: six legacy
routes became one route with a `?tab=` search parameter — `docs/IA.md` §2's shape, with DEC-071 and
DEC-074 settling what each tab holds. The tab is in the URL, so a link to one still works, but a
redirect for these has to add a query string rather than only rewrite a path.

**3. Nothing redirects today.** `next.config.ts` has no `redirects()` and `proxy.ts` rewrites
nothing but the locale. In this deployment that is harmless, because nginx still serves the **legacy**
app at `/` and this one is reachable only on its own host port (`WEB_NEXT_PORT`, currently 3001) —
the two are not yet competing for the same URLs. The redirect table at the bottom of this file is
what has to exist **before** this app takes over `/`, and it is a deployment task, not a code one.

---

## Public routes

| Old route                                | New route                                 | Change                                      | Notes                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                      | `/`                                       | Locale prefix only                          | Public landing (A-001)                                                                                                                                             |
| `/faq`                                   | — (removed)                               | **Dropped**                                 | The document was ReCodEx's own wiki, describing another university's instance. See `DROPPED.md` DROP-C06; our own FAQ is X-005                                     |
| `/login/:redirect?`                      | `/login?redirect=…`                       | **Redirect target moved to a search param** | `/login/dashboard` → `/login?redirect=/en/dashboard`; the value is a full path now                                                                                 |
| `/registration`                          | `/register`                               | **Renamed**                                 | Shown closed where `ALLOW_LOCAL_REGISTRATION` is off (A-003)                                                                                                       |
| `/forgotten-password`                    | `/forgot-password`                        | **Renamed**                                 | —                                                                                                                                                                  |
| `/forgotten-password/change`             | `/forgot-password/change`                 | **Renamed**                                 | Reached from the emailed link, carries the token as a search param                                                                                                 |
| `/email-verification`                    | `/email-verification`                     | Locale prefix only                          | —                                                                                                                                                                  |
| `/accept-invitation`                     | `/accept-invitation`                      | Locale prefix only                          | Registration-by-invitation (S-024)                                                                                                                                 |
| `/accept-group-invitation/:invitationId` | `/accept-group-invitation/[invitationId]` | Locale prefix only                          | Requires a session, unlike the one above (S-023)                                                                                                                   |
| `*` (NotFound)                           | `not-found.tsx` conventions               | **Not a route**                             | `global-not-found.tsx` catches unmatched URLs; `[locale]/not-found.tsx` catches `notFound()`. The recon plan's `/[...not-found]` was never built and is not needed |

---

## Dashboard

| Old route | New route    | Change      | Notes                                     |
| --------- | ------------ | ----------- | ----------------------------------------- |
| `/app`    | `/dashboard` | **Renamed** | `/app` carried no meaning; the app is `/` |

---

## Groups

Six legacy routes collapsed into one screen with tabs. `?tab=` is the only difference between them,
and the tab is in the URL so a link to a particular tab still works.

| Old route                           | New route                            | Change                                | Notes                                                   |
| ----------------------------------- | ------------------------------------ | ------------------------------------- | ------------------------------------------------------- |
| `/app/group/:groupId/info`          | `/groups/[groupId]?tab=info`         | **Route → tab**                       | Also the default tab, so `/groups/[groupId]` lands here |
| `/app/group/:groupId/assignments`   | `/groups/[groupId]?tab=assignments`  | **Route → tab**                       | —                                                       |
| `/app/group/:groupId/students`      | `/groups/[groupId]?tab=students`     | **Route → tab**                       | Roster and the points matrix (S-007, T-006)             |
| `/app/group/:groupId/exams`         | `/groups/[groupId]?tab=exams`        | **Route → tab**                       | —                                                       |
| `/app/group/:groupId/exams/:examId` | `/groups/[groupId]?tab=exams&exam=…` | **Route → tab + search param**        | —                                                       |
| `/app/group/:groupId/edit`          | `/groups/[groupId]?tab=settings`     | **Route → tab**                       | Editing a group is not a separate screen (S-009)        |
| `/app/group/:groupId/user/:userId`  | `/groups/[groupId]/users/[userId]`   | **Prefix removed, `user` pluralised** | One student's whole course (T-005)                      |
| `/app/archive`                      | `/archive`                           | **Prefix removed**                    | Archived groups only                                    |
| —                                   | `/groups`                            | **New**                               | The group list had no route of its own in legacy        |
| —                                   | `/groups/[groupId]/assign`           | **New**                               | Picking an exercise to assign (T-001)                   |

---

## Assignments

| Old route                                    | New route                                    | Change                         | Notes                                     |
| -------------------------------------------- | -------------------------------------------- | ------------------------------ | ----------------------------------------- |
| `/app/assignment/:assignmentId`              | `/assignments/[assignmentId]`                | **Prefix removed, pluralised** | One screen, two audiences (S-012, S-013)  |
| `/app/assignment/:assignmentId/user/:userId` | `/assignments/[assignmentId]/users/[userId]` | **Prefix removed, pluralised** | —                                         |
| `/app/assignment/:assignmentId/edit`         | `/assignments/[assignmentId]/edit`           | **Prefix removed**             | —                                         |
| `/app/assignment/:assignmentId/solutions`    | `/assignments/[assignmentId]/solutions`      | **Prefix removed**             | Every attempt, one row each (T-003)       |
| —                                            | `/assignments/[assignmentId]/submit`         | **New**                        | Submitting is its own screen here (S-014) |

---

## Solutions

An assignment solution is a first-class entity in the new IA: its assignment is on the payload, so
carrying the assignment id through the URL bought nothing and made every link longer.

| Old route                                                                   | New route                             | Change                         | Notes                                                   |
| --------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `/app/assignment/:assignmentId/solution/:solutionId`                        | `/solutions/[solutionId]`             | **Assignment context dropped** | —                                                       |
| `/app/assignment/:assignmentId/solution/:solutionId/sources`                | `/solutions/[solutionId]/sources`     | **Assignment context dropped** | Source viewer and the review on top (S-017, S-018)      |
| `/app/assignment/:assignmentId/solution/:solutionId/plagiarisms`            | `/solutions/[solutionId]/plagiarisms` | **Assignment context dropped** | —                                                       |
| `/app/assignment/:assignmentId/solution/:solutionId/diff/:secondSolutionId` | **not built**                         | —                              | **G-005.** The comparison screen has no counterpart yet |

---

## Shadow assignments

| Old route                               | New route                        | Change                         | Notes                                                                    |
| --------------------------------------- | -------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| `/app/shadow-assignment/:shadowId`      | `/shadow-assignments/[shadowId]` | **Prefix removed, pluralised** | —                                                                        |
| `/app/shadow-assignment/:shadowId/edit` | **not built**                    | —                              | **G-009.** Points can be awarded; the entity cannot be created or edited |

---

## Exercises

| Old route                                                            | New route                                                  | Change                        | Notes                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/exercises`                                                     | `/exercises`                                               | **Prefix removed**            | Server-side search and paging (T-020)                                                                                                                                 |
| `/app/exercises/:exerciseId`                                         | `/exercises/[exerciseId]`                                  | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/edit`                                    | `/exercises/[exerciseId]/edit`                             | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/assignments`                             | `/exercises/[exerciseId]/assignments`                      | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/reference-solutions`                     | `/exercises/[exerciseId]/reference-solutions`              | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/edit-config`                             | `/exercises/[exerciseId]/edit-config`                      | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/edit-limits`                             | `/exercises/[exerciseId]/edit-limits`                      | **Prefix removed**            | —                                                                                                                                                                     |
| `/app/exercises/:exerciseId/reference-solution/:referenceSolutionId` | `/exercises/[exerciseId]/reference-solutions/[solutionId]` | **Nested under its exercise** | The recon plan promised a top-level `/reference-solutions/[id]`; a reference solution is only ever read in the context of the exercise it proves, so it stayed nested |

---

## Pipelines

| Old route                                | New route                      | Change                  | Notes                                                                       |
| ---------------------------------------- | ------------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| `/app/pipelines`                         | `/pipelines`                   | **Prefix removed**      | —                                                                           |
| `/app/pipelines/:pipelineId`             | `/pipelines/[pipelineId]`      | **Prefix removed**      | —                                                                           |
| `/app/pipelines/:pipelineId/edit`        | `/pipelines/[pipelineId]/edit` | **Prefix removed**      | —                                                                           |
| `/app/pipelines/:pipelineId/edit-struct` | `/pipelines/[pipelineId]/edit` | **Merged into `/edit`** | Two legacy screens edit the same entity's two halves; T-016 put them on one |

---

## People

| Old route                | New route              | Change                                | Notes                                                                                                                                                                                        |
| ------------------------ | ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/users`             | `/users`               | **Prefix removed**                    | —                                                                                                                                                                                            |
| `/app/user/:userId`      | `/users/[userId]`      | **Prefix removed, pluralised**        | —                                                                                                                                                                                            |
| `/app/user/:userId/edit` | `/users/[userId]/edit` | **Prefix removed, split by audience** | **Editing oneself redirects to `/profile/edit`** (DEC-111): core-api refuses `setRole`, `setIsAllowed` and a forced password change on the current user, so the two screens genuinely differ |
| —                        | `/users/import`        | **New**                               | Importing a list of people (AD-009). `?group=` scopes it to one course and is offered on that group's `inviteStudents` hint; without it, the superadmin's (X-015, DEC-151)                   |
| —                        | `/profile`             | **New**                               | One's own account (S-021)                                                                                                                                                                    |
| —                        | `/profile/edit`        | **New**                               | One's own settings (S-022)                                                                                                                                                                   |

---

## Administration

| Old route                           | New route                       | Change                | Notes                                                                                                                                  |
| ----------------------------------- | ------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/server`                       | `/admin`                        | **Moved and renamed** | The recon plan said `/admin/server`. The page is the broker and the background jobs, not "server management" (DEC-114)                 |
| `/admin/instances`                  | `/admin/instances`              | Locale prefix only    | —                                                                                                                                      |
| `/app/instance/:instanceId`         | `/admin/instances/[instanceId]` | **Merged**            | core-api's whole instance-update body is `{isOpen}`, so the detail and edit screens are one, and the licences live there too (DEC-113) |
| `/admin/instances/:instanceId/edit` | `/admin/instances/[instanceId]` | **Merged**            | Same row as above                                                                                                                      |
| `/app/submission-failures`          | `/submission-failures`          | **Prefix removed**    | —                                                                                                                                      |
| `/app/system-messages`              | `/system-messages`              | **Prefix removed**    | —                                                                                                                                      |

---

## Routes with no legacy counterpart

These are not redirect targets; they are listed so the map is complete.

| Route                                                       | What it is                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/design-system`                                        | D-013's component showcase. Deliberately outside the product IA and outside the `(anon)` route group; renders no user data              |
| `/api/auth/*`                                               | The BFF: login, logout, refresh, takeover, restricted tokens, the external-auth callback, registration checks, the session-expired sink |
| `/api/upload/partial*`, `/api/upload/[id]/digest`           | Chunked upload, because Server Actions cap a request body around 1 MB and solution archives do not (brief §6.7)                         |
| `/api/solutions/[id]/download`, `/api/exercises/[id]/files` | Streaming downloads that must not pass through a Server Action                                                                          |
| `/api/groups/[groupId]/points`                              | The points export as a file (T-007)                                                                                                     |
| `/api/search`                                               | The command palette's backing search                                                                                                    |

---

## The redirect table

Needed only when this app takes over the URL the legacy app answers on today. Written for
`next.config.ts`'s `redirects()`, which runs **before** `proxy.ts` and therefore before locale
negotiation — so a redirect cannot know the visitor's language. Two ways to handle that, and the
second is the one to use:

- Send everything to the unprefixed path and let `proxy.ts` negotiate the locale on the next hop.
  Costs a second redirect but always picks the right language.
- Hardcode a locale. Cheaper, and wrong for half the users. Do not.

```ts
// next.config.ts — redirects() run before proxy.ts, so no locale prefix here.
async redirects() {
  return [
    // Tabs: these need the query string, so they come before the generic /app rule.
    { source: "/app/group/:groupId/info", destination: "/groups/:groupId?tab=info", permanent: true },
    { source: "/app/group/:groupId/assignments", destination: "/groups/:groupId?tab=assignments", permanent: true },
    { source: "/app/group/:groupId/students", destination: "/groups/:groupId?tab=students", permanent: true },
    { source: "/app/group/:groupId/exams", destination: "/groups/:groupId?tab=exams", permanent: true },
    { source: "/app/group/:groupId/exams/:examId", destination: "/groups/:groupId?tab=exams&exam=:examId", permanent: true },
    { source: "/app/group/:groupId/edit", destination: "/groups/:groupId?tab=settings", permanent: true },
    { source: "/app/group/:groupId/user/:userId", destination: "/groups/:groupId/users/:userId", permanent: true },

    // Solutions drop their assignment context.
    { source: "/app/assignment/:a/solution/:s", destination: "/solutions/:s", permanent: true },
    { source: "/app/assignment/:a/solution/:s/sources", destination: "/solutions/:s/sources", permanent: true },
    { source: "/app/assignment/:a/solution/:s/plagiarisms", destination: "/solutions/:s/plagiarisms", permanent: true },

    // Singular → plural.
    { source: "/app/assignment/:id", destination: "/assignments/:id", permanent: true },
    { source: "/app/assignment/:id/:rest*", destination: "/assignments/:id/:rest*", permanent: true },
    { source: "/app/shadow-assignment/:id", destination: "/shadow-assignments/:id", permanent: true },
    { source: "/app/user/:id", destination: "/users/:id", permanent: true },
    { source: "/app/user/:id/edit", destination: "/users/:id/edit", permanent: true },

    // Merged screens.
    { source: "/app/exercises/:e/reference-solution/:r", destination: "/exercises/:e/reference-solutions/:r", permanent: true },
    { source: "/app/pipelines/:id/edit-struct", destination: "/pipelines/:id/edit", permanent: true },
    { source: "/app/instance/:id", destination: "/admin/instances/:id", permanent: true },
    { source: "/admin/instances/:id/edit", destination: "/admin/instances/:id", permanent: true },
    { source: "/app/server", destination: "/admin", permanent: true },

    // Renamed anonymous routes.
    { source: "/registration", destination: "/register", permanent: true },
    { source: "/forgotten-password", destination: "/forgot-password", permanent: true },
    { source: "/forgotten-password/change", destination: "/forgot-password/change", permanent: true },
    { source: "/login/:redirect*", destination: "/login", permanent: true },

    // Everything else under /app, last so the specific rules above win.
    { source: "/app", destination: "/dashboard", permanent: true },
    { source: "/app/:path*", destination: "/:path*", permanent: true },
  ];
}
```

Two of these lose information on purpose, and both are the right trade:

- **`/login/:redirect*` drops the redirect target.** The legacy path segment is a bare pathname with
  no locale and no leading slash; reconstructing a valid `?redirect=` from it would mean guessing the
  locale, and landing a visitor on the wrong-language version of the page they asked for is worse
  than landing them on their dashboard.
- **`/admin/instances/:id/edit` and `/app/instance/:id` both land on the same merged screen**, so a
  bookmark to the edit form and one to the detail view now open the same page. That is what DEC-113
  decided; the alternative is a screen with one checkbox on it.

**Not covered by any rule, because there is nowhere to send them:** `/app/assignment/:a/solution/:s/diff/:other`
(G-005) and `/app/shadow-assignment/:id/edit` (G-009). Until those are built, a redirect would land
on a 404 with an extra hop. Add them to this table with the tickets.

---

## Open questions

| #     | Question                                                                    | Status                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-001 | `next.config.ts` `redirects()` or nginx?                                    | **Answered:** `redirects()`. It travels with the app, and the tab rules need path matching nginx would express clumsily. nginx would work if the cutover is staged app-by-app           |
| R-002 | Legacy routes not in `routes.js` — links inside emails core-api sends       | **Open.** core-api builds those from its own configured frontend URL, not from this repo, so they are an operator's setting at cutover. No SMTP here (Q-007), so none has been observed |
| R-003 | `/login/:redirect?` preserved or moved to a search param?                   | **Answered:** search param, carrying a full locale-prefixed path                                                                                                                        |
| R-004 | Does the cutover keep the legacy app reachable at a second URL for a while? | **Open, and it decides whether the `/app/:path*` catch-all is safe.** If both apps stay up, that rule must not be added, or the legacy app becomes unreachable                          |

## Documentation (X-002)

Two routes with no legacy counterpart: the legacy app documents itself in a wiki elsewhere, and
this one carries its own guides.

| Legacy | New            | Change  | Notes                                                                  |
| ------ | -------------- | ------- | ---------------------------------------------------------------------- |
| —      | `/docs`        | **New** | The signpost: three guides, one per audience                           |
| —      | `/docs/[slug]` | **New** | `install`, `teacher`, `student` — a closed set; anything else is a 404 |

Both are public (`proxy.ts`), which is why they live in the `(anon)` route group.
