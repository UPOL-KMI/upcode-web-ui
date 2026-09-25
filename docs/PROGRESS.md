# ReCodEx New Frontend — Progress Log

**Status:** Append-only log
**Format:** `[YYYY-MM-DD HH:mm] TICKET-ID: Summary — Observations`

---

## 2026-05-11

### Recon Phase

- **[2026-05-11 10:00] RECON-001:** Read brief `nextjs-frontend-agent-brief.md` in full. Key takeaways: new Next.js 16.3 frontend, no API modifications, feature parity with legacy, auth via httpOnly cookies, BFF pattern, no persona route groups, breadcrumbs mandatory, deep-linkable state in searchParams.
  - _Observations:_ Brief is exceptionally detailed and well-structured. The emphasis on not blocking (except compose file) and documenting decisions suggests a mature operator relationship.

- **[2026-05-11 10:15] RECON-002:** Enumerated legacy `web-app` routes from `src/pages/routes.js`. Identified 50+ routes across 12 top-level sections. Mapped auth requirements (true/false/undefined).
  - _Observations:_ Legacy uses `react-router-dom` with manual route declarations. `customLoadGroups` pattern suggests group-specific data loading is a common concern. `pathRelatedGroupSelector` hints at complex group context propagation.

- **[2026-05-11 10:30] RECON-003:** Analyzed legacy auth module (`src/redux/modules/auth.js`). Identified token storage in localStorage, login/logout/refresh/CAS callback flows, user takeover, restricted token generation, and instance ID handling.
  - _Observations:_ `redux-promise-middleware` handles async actions. `decodeAndValidateAccessToken` is a pure function for JWT decoding. `instanceId` is extracted from first instance in user data.

- **[2026-05-11 10:45] RECON-004:** Analyzed legacy API middleware (`src/redux/middleware/apiMiddleware.js`). Identified `CALL_API` action type, `apiCall` helper with headers/token/uploadFiles handling, and `createApiCallPromise` for actual HTTP requests.
  - _Observations:_ `uploadFiles: true` switches to FormData. `wasSuccessful` allows custom success validation. `doNotProcess` skips response transformation.

- **[2026-05-11 11:00] RECON-005:** Created `docs/INVENTORY.md` — mapped all 50+ routes to new IA destinations, catalogued 40+ Redux modules, listed key mechanisms to reproduce, documented domain landmines.
  - _Observations:_ The inventory is comprehensive but will need refinement during implementation. Some destinations are tentative (marked with `IA-ASSUMPTION` tag).

- **[2026-05-11 11:15] RECON-006:** Created `docs/IA.md` — designed sitemap with context-based routing, navigation model (sidebar + breadcrumbs + command palette), PageShell component interface, key screen designs (dashboard, group detail, assignment detail, solution detail, exercise config editor).
  - _Observations:_ The dashboard dual-section design (student + teacher) is the most novel aspect. It directly addresses §2's "one person, two audiences" requirement.

- **[2026-05-11 11:30] RECON-007:** Created `docs/BACKLOG.md` — organized tickets into 7 phases: Foundation (F-001..F-026), Design System (D-001..D-013), Student Experience (S-001..S-024), Anonymous Flows (A-001..A-008), Teacher (T-001..T-019), Admin (AD-001..AD-008), Parity Sweep (P-001..P-008).
  - _Observations:_ Total 120+ tickets. Foundation phase is critical path. Seed script (F-025) is prioritized per brief §1.

- **[2026-05-11 11:45] RECON-008:** Created `docs/DECISIONS.md` — documented architecture decisions (Next.js 16.3, TS strict, pnpm, Tailwind + shadcn/ui, Server Components, httpOnly cookie auth, two API URLs), deferred decisions (cacheComponents, React Compiler, Graphviz, WebSocket), dropped features (SKIN, Redux, moment.js), and assumptions (tagged `IA-ASSUMPTION`).
  - _Observations:_ The decision log will be crucial for future sessions. Each assumption has an "if wrong" fallbback plan.

- **[2026-05-11 12:00] RECON-009:** Verified `docs/QUESTIONS.md` exists with operator and technical questions. No unresolved questions block recon.
  - _Observations:_ All questions have reasonable assumptions recorded. Will proceed on these assumptions per §3's "Never block" rule.

- **[2026-09-01 14:20] T-005:** One student's whole course, submission by submission.
  `app/[locale]/(app)/groups/[groupId]/users/[userId]/page.tsx`, `lib/api/group-user-solutions.ts`,
  `components/groups/close-pending-reviews.tsx`, `closePendingReviews()`.
  - _The third way this app cuts the same solutions._ T-003 is one assignment across the class,
    S-013's per-user page is one assignment for one person; this is one **person** across the whole
    course, which is the view a teacher wants when the question stops being about the work.
  - **_It is one table with an Assignment column, not the legacy screen's stack of boxes
    (DEC-094)._** Sorting that column is the grouping, and it lives in the URL rather than in
    `localStorage`; the filter box then narrows to one assignment by name or to a note across all of
    them, which the boxes cannot do at all. "Best solutions only" stays a real filter (`?filter=`)
    because no sort expresses it.
  - _T-003's table grew a `lead` mode rather than being copied._ Six of its seven columns ask the
    same question of the same rows; only the first names something different (author there,
    assignment here). The attempt number became the row's link to the solution, since in this mode
    the lead cell links to the **assignment**.
  - **_A student may open their own page and is refused a classmate's_** -- core-api's
    `canViewStudentStats` is written against the student as well as the group, so there is no hint
    to read (DEC-090's shape, third time). The roster's own rule is restated instead: staff of the
    group, or one's own row. Verified live from both sides: 200 for herself, 403 for the classmate.
  - _core-api answers **400**, not 404, for "this person does not study here"_ -- mapped to
    `notFound()` in this one module, since for every other endpoint a 400 really is a bug in the
    request.
  - **_Closing every open review at once_** is the screen's only write, and it confirms first, which
    the legacy button does not: closing publishes the comments to the student and mails them, and
    reopening does not un-read them. `Promise.allSettled`, so one refusal does not abandon the rest.
  - _S-021's owed link is paid:_ a group the person studies in now links to what they submitted
    there, where the reader teaches that group or is that person.
  - **_A missing string was found by looking, not by any check we had._** `Profile.groupSolutions`
    rendered as its own key on the profile page -- next-intl prints the path rather than throwing,
    and nothing in `typecheck`/`lint`/`build` sees message keys at all. `lib/i18n-text/messages.test.ts`
    now asserts both locales hold the same keys and that every literal key the source asks for
    exists; it fails on that exact bug, checked by removing the key again.
  - _Verified live in both locales_, and the bulk close was exercised on a review this session
    opened and erased, leaving the three seeded ones -- the dashboard's queue fixture -- untouched.
  - _Observations:_ **164 e2e tests pass** (156 before), 64 unit tests (55 before).

- **[2026-09-01 14:55] T-007:** The points matrix as a file.
  `app/api/groups/[groupId]/points/route.ts`, `getGroupPointsExport()`, `lib/format/csv.ts`.
  - **_A Route Handler, not a browser-side blob (DEC-095)._** The link needs no JavaScript, can be
    bookmarked or curl'd, and re-reads the numbers from core-api at the moment of the download
    rather than shipping whatever the page was rendered with -- which also means core-api re-checks
    the reader, instead of the download trusting a button that was rendered.
  - _Semicolons and a UTF-8 BOM,_ which is what the legacy "Excel export" actually is: the deployment's
    Excel splits on `;`, and the BOM is the difference between `Jiří Novák` and mojibake. **CSV only**
    -- a real `.xlsx` is a new dependency or a hand-rolled ZIP for a capability legacy never had, so
    the ticket's "(CSV/Excel)" is answered the way legacy answers it, and the row now says so.
  - **_Shadow assignments are columns here, though the matrix on screen has none._** Their points are
    inside every row total (DEC-079), and a file whose columns do not add up to its own total column
    is one somebody will spend an afternoon disbelieving. The seeded group makes the case by itself:
    Alice's 8 points are entirely a shadow assignment's.
  - _Emails ride along where core-api discloses them_ -- the same `/v1/users/list` response the names
    come from, so no extra request -- because matching a row to a person in another system is the
    reason to export at all. Verified: a reader who may not see them gets the column empty, not absent.
  - **_A legacy bug not reproduced._** `escapeString` is JavaScript string escaping applied to a CSV
    field, so the legacy file backslash-escapes an embedded quote; RFC 4180 doubles it. A student
    named `O"Brien` breaks the legacy file and not this one. Unit-tested, with the file name
    sanitiser beside it -- a group name is free text and a `Content-Disposition` header is exactly
    where an unescaped one stops being an inconvenience.
  - _Verified live:_ downloaded in both locales (the column headers are the assignment names, so the
    locale rides in the query string -- `/api/...` has no locale segment for next-intl to read), an
    unknown locale falls back rather than failing, a session-less request lands on the login page, and
    a student's download is core-api's own narrowed answer rather than this app's.
  - _Observations:_ **164 e2e tests pass**, 64 unit tests.

- **[2026-09-01 15:40] T-019:** Submissions that never became a result.
  `app/[locale]/(app)/submission-failures/page.tsx`, `lib/api/submission-failures.ts`,
  `components/failures/failure-table.tsx`, `resolveSubmissionFailure()`.
  - _The one screen in this app that is about the machine rather than about anybody's work._ A job
    the broker refused, an evaluation that died, results that could not be read back, an exercise
    configuration that will not compile -- core-api keeps each one until somebody says it has been
    dealt with.
  - **_Not a teacher's view, whatever the ticket said._** The failure ACL is the instance's, not a
    group's: a supervisor who administers a group is refused, verified live. No role check here --
    `apiRead` turns core-api's 403 into the refusal page, and the sidebar already only shows the
    link inside its Administration section.
  - **_It opens on the unresolved queue (DEC-096)._** core-api serves that list itself; the full
    history is unbounded and unpaginated, and this instance is already at fifty-odd because its
    sandbox cannot run at all. "Everything" is one click away, so no parity is lost.
  - **_Resolving is permanent -- core-api has no un-resolve_** -- so it is a dialog with a typed
    note rather than a button that fires on one click, and it says so in the dialog. The
    notification email to the author is offered (the legacy screen offers it, and a student whose
    solution vanished into an infrastructure error is exactly who should hear back) but defaults to
    **off**: an email is the irreversible half of an already irreversible action.
  - _A reference solution's failure names itself and does not link._ Eight of the fifty-two here are
    the seed's own reference submissions, and T-011 has not built that screen -- a link to a route
    that does not exist would be prefetched and 404 from this page on every render (DEC-066).
  - _The kinds are words, not an icon with a tooltip._ core-api has five and they are five
    different people's problems; both locales carry the label and core-api's own one-line meaning.
  - _Verified live in both locales,_ including a real resolve: the row left the queue, appeared in
    the history with its note, and the count dropped by one.
  - _Its spec resolves one failure and cannot put it back,_ which is affordable here only because
    this instance mints a new one every time the submit spec runs -- noted in the spec itself.
  - _Observations:_ **167 e2e tests pass** (164 before), 64 unit tests.

- **[2026-09-01 16:45] T-020 (filed this session):** The exercise catalog, and a search that was
  not searching. `app/[locale]/(app)/exercises/page.tsx`, `getExerciseCatalog()`,
  `components/exercises/exercise-table.tsx`, `lib/api/runtime-environments.ts`, `scripts/seed.ts`.
  - **_The ticket did not exist._** The teacher block goes from assigning an exercise (T-001)
    straight to editing one (T-008), and `INVENTORY.md` carried the catalog and the exercise detail
    as todo rows nobody owned -- while the sidebar has linked to the catalog since D-014 and found a
    `PlaceholderPage`. Filed as T-020 and T-021, the same correction S-026 was.
  - **_A shipped bug, found by reading the endpoint's own whitelist:_** core-api takes its filters
    in a **`filters` array** (`filters[search]`, `filters[archived]`, `filters[runtimeEnvironments][]`),
    and an unknown top-level parameter is silently ignored -- so T-001's picker, which sent
    `?search=`, had a search box that did nothing and a "matched" count that was the size of the
    whole catalog. Confirmed live before and after (`filters[search]=zzz` answers `totalCount: 0`;
    `search=zzz` answers everything). Fixed for both callers, and T-001's spec now asserts on an
    exercise that must **disappear**, which is what makes it a test of the search.
  - **_DEC-093 was wrong about one thing and is corrected in place:_** `hasReferenceSolutions` _is_
    in the list payload, so the fifth condition on assigning is knowable before the click. The
    picker now says "No reference solution" instead of letting core-api refuse the attempt.
  - _Everything that narrows the list is a query parameter (DEC-097)_ -- search, tag, language,
    archived scope, page -- so the screen is a plain `GET` form and two links, works without
    JavaScript, and a narrowed view is an address. Ordering is core-api's too, collated in the
    reader's locale: a page of twenty sorted in the browser would be sorting the wrong twenty.
  - **_Creating an exercise is deliberately not here._** `POST /exercises` makes an empty, broken,
    unassignable exercise; it belongs with T-008's editor, the way assigning belongs with T-002's
    settings. A create button now would land the reader on a route that does not exist.
  - **_The seed grew 24 catalog fixtures_**, unconfigured on purpose: every one is `isBroken` with
    no reference solution, which is exactly the state a half-written exercise is in and one the
    catalog has to render. Tags, difficulties and one archived exercise, so each filter has
    something to filter by, and the list is past one page.
  - _A seeding gotcha found the hard way:_ `GET /exercises` **excludes archived exercises**, so the
    seed's lookup-by-name could not see the archived fixture and created a second copy of it on
    every run. `findExerciseByName` now passes `filters[archived]=all`; the stray copy was deleted
    and a re-run confirmed idempotence (25 exercises before and after).
  - _Verified live in both locales:_ search, tag, language and archived filters, both pages of the
    catalog, and the picker's search actually narrowing.
  - _Observations:_ **171 e2e tests pass** (167 before), 64 unit tests.

- **[2026-09-01 17:40] T-021:** One exercise, read -- and what "broken" actually means.
  `app/[locale]/(app)/exercises/[exerciseId]/page.tsx`, `lib/api/exercise-detail.ts`,
  `components/exercises/exercise-detail.tsx`, `lib/format/bytes.ts`.
  - _Where the catalog's rows lead, and where T-008's editor will return to._ The screen answers
    "should I assign this" in the order the question is actually asked: what state the exercise is
    in, what it asks a student to do, and what it is made of.
  - **_When core-api says an exercise is broken, it also says why._** `validationError` is a string
    of `@key message` lines (`@no-runtimes`, `@no-hwgroups`, `@no-tests`, ... -- nine keys the
    legacy app translates), and each one is a specific missing piece somebody can act on. Rendering
    that list is the most useful thing on the page; a red badge alone leaves the reader guessing.
    An unknown key keeps core-api's own English rather than being dropped.
  - _Read-only, deliberately._ Tests (T-009), limits (T-010), reference solutions (T-011) and the
    assignments made from this exercise (T-012) are **named and not linked** -- none of those
    screens exists, and Next prefetches every visible link (DEC-066). The assignment _count_ is
    here, because it is what says the exercise is in use, and core-api counts only the assignments
    this reader may see.
  - _Reference solutions are stated as a fact, not counted._ `/v1/reference-solutions/exercise/{id}`
    answers **8 for the administrator and 0 for a supervisor of the same exercise** -- they are
    private until promoted -- so a count would say different things to different readers about the
    same exercise. `hasReferenceSolutions` is the exercise's own truth and the condition that
    matters: without one it cannot be assigned.
  - _A group this reader cannot see is said out loud_ ("and 1 group you cannot see") rather than
    silently dropped from the list -- DEC-080's shape, applied to a count.
  - **_`formatBytes` moved into `lib/format/bytes.ts`_** with tests, from where it was hiding
    inside the upload component: the attachment list and the solution-size limit render the same
    number, and two copies of a rounding rule is how two screens end up disagreeing about how big
    a file is.
  - **_A parity gap found and filed as T-022:_** the legacy app puts a discussion thread on four
    screens (exercise, assignment, assignment solutions, solution sources) and nothing here has
    built any of them. `INVENTORY.md`'s `comments` row pointed at S-018's inline review comments,
    which is a different feature; the row is corrected.
  - _Verified live in both locales_ -- a finished exercise, a broken one (three reasons in words),
    and an archived one.
  - _Observations:_ **174 e2e tests pass** (171 before), 68 unit tests (64 before).

- **[2026-09-01 18:30] T-008:** Making an exercise, and everything about it that is a setting.
  `app/[locale]/(app)/exercises/[exerciseId]/edit/page.tsx`,
  `components/exercises/{exercise-form,exercise-controls,create-exercise}.tsx`,
  `lib/actions/exercise.ts`.
  - **_Create first, configure second (DEC-098)._** core-api's `actionCreate` takes a group and
    nothing else -- it names the exercise after its author, in the author's own language, and
    leaves it without tests -- so there is nothing a wizard could collect first. The reader lands
    on the settings form with the exercise already real, and a new exercise is **broken by
    construction**: nobody can assign it and no student can meet it in the meantime.
  - _One save carrying every field, with `version` as the optimistic lock_ -- core-api replaces the
    exercise with what it is sent, exactly as it does an assignment (DEC-092's reasoning, second
    time). Every locale is edited at once for the same reason, and a locale left blank is dropped
    rather than saved empty, which is how core-api deletes one.
  - _Tags, groups, archiving and deletion are **not** fields of that save._ Each is its own call
    that takes effect immediately, so they sit beside the form rather than in it -- folding them in
    would mean faking a transaction that does not exist.
  - **_A bug its own spec found, one step after archiving:_** core-api's update rule carries
    `exercise.notArchived`, so **archiving an exercise takes `update` away** -- and the page,
    gated on `update`, refused the reader the very screen holding the button that undoes it. The
    gate is now any of `update`/`archive`/`remove` (S-009's rule for an archived group, which had
    the same shape and got it right), the form is rendered only where `update` is real, and the
    group controls are hidden for an archived exercise because core-api refuses those too.
  - _Attaching and detaching a group have no hint_ -- both rules are written against the exercise
    **and** the group (DEC-090's shape, fourth time) -- so the offer is the groups the reader
    teaches, and detaching the **last** group is not offered at all, because
    `exercise.hasAtLeastTwoAttachedGroups` refuses it.
  - _`mergeJudgeLogs` is carried through the detail module purely so the form cannot flip it._ It
    is not shown anywhere else; a form that defaulted it would have quietly changed a setting
    nobody edited.
  - **_What T-008 deliberately does not do is filed as T-023, not dropped:_** the exercise's own
    files and their link keys (which the markdown renderer does not substitute yet -- assignments
    have the same gap), its administrators, and forking it into another group.
  - _Verified live in both locales_, and by a spec that creates a real exercise, saves it, tags it,
    attaches a second group, archives and restores it, reads it back on the detail screen and
    deletes it -- 25 exercises before and after.
  - _Observations:_ **176 e2e tests pass** (174 before), 68 unit tests.

- **[2026-09-01 19:15] A-002:** The front door -- a sign-in form, at last.
  `app/[locale]/(anon)/login/page.tsx`, `components/auth/login-form.tsx`,
  `lib/auth/{redirect-target,short-session}.ts`.
  - _`/login` has been a `PlaceholderPage` since F-013,_ in front of a BFF route that only the e2e
    suite ever called -- which is to say the product had no way in. It has one now.
  - **_It posts to the Route Handler, not to a Server Action (DEC-099)._** That route is what sets
    the httpOnly cookie (brief §5) and has existed since F-016; wrapping it in an action would add
    a hop and a second thing to keep in step. `router.refresh()` runs before the navigation,
    because the app shell is a Server Component that reads the session and would otherwise render
    the next page still believing nobody is signed in.
  - **_`?from=` is an open-redirect guard first._** `proxy.ts` writes the refused path there, and
    anything that is not a single-slash path on this app becomes the dashboard --
    `//evil.example`, an absolute URL, `/\evil.example`. Unit-tested, and the spec proves it is
    wired: a sign-in form that forwards the browser wherever a link says is a phishing tool.
  - _Three things reach this page and each says why:_ `?from=` (you asked for a page behind the
    session), `?externalAuthError=1` (F-019's callback could not use its token) and nothing at all.
    A visitor who already has a session never sees it -- `proxy.ts` sends them to the dashboard,
    which is why there is no "you are already signed in" branch the legacy page needs.
  - _Short sessions are supported where a deployment configures them_ (`SHORT_SESSION_MINUTES`,
    the legacy `SHORT_SESSION` in the same unit) and computed server-side; this deployment sets
    none, so the checkbox is absent, exactly as the legacy app hides it.
  - _External sign-in is still not offered_ -- no authenticator is configured here (Q-004) -- so
    A-007 owns that button. The callback's failure is already rendered.
  - **_`e2e/helpers/auth.ts` keeps calling the route, and its note now says why:_** core-api hashes
    passwords with bcrypt, and the helper runs once per persona rather than once per test.
    `login.spec.ts` is the one place that drives the real form, so what every other spec assumes is
    checked somewhere.
  - _Verified live:_ a wrong password answers with core-api's own words and keeps the address, a
    right one lands where `?from=` said, and an absolute `from` lands on the dashboard instead.
  - _Observations:_ **181 e2e tests pass** (176 before), 72 unit tests (68 before).

- **[2026-09-01 20:10] A-004 + A-005:** Getting back in without a password.
  `app/[locale]/(anon)/forgot-password/{page,change/page}.tsx`,
  `components/auth/{forgot-password-form,change-password-form}.tsx`,
  `app/api/auth/{forgotten-password,forgotten-password/change,password-strength}/route.ts`,
  `lib/auth/query-token.ts`.
  - **_The request form answers the same way for every address (DEC-100)._** core-api 404s for an
    unknown login; passing that through would make this form an account-existence oracle for
    anybody with a list of addresses. "If we know that address, a message is on its way" is true
    and is all anybody needs.
  - **_This app answers the address core-api's own emails point at._** `WebappLinks.php` builds the
    link as `"%webapp.address%/forgotten-password/change?{token}"` and this app's IA spells that
    screen `/forgot-password/change`, so `proxy.ts` forwards the old address with its query intact
    -- otherwise every deployment would have to override `linkTemplates` before its own emails
    worked. Done in the proxy and not in a page calling `redirect()`: a page must await
    `searchParams` first, and by then Next has begun streaming and falls back to a one-second
    `<meta refresh>`, which was verified rather than assumed.
  - _The token is the **whole query string**,_ as S-024 found for invitations -- so that page's
    reader was extracted into `lib/auth/query-token.ts` and both use it, with tests.
  - **_It is a bearer for exactly one call, never a session._** core-api issues it with the
    `change-password` scope and, on success, sets the user's token validity threshold -- which
    kills that token and every other one they hold. So the reader is sent to sign in with the new
    password, and the login page says so; being signed in here is not something this app declined
    to do, it is something that no longer exists to be done.
  - _Password strength is core-api's own zxcvbn_ (`/forgotten-password/validate-password-strength`,
    proxied so the browser never has to know where core-api is), asked for on a debounce. A score
    of **zero is refused**, exactly as the legacy form refuses it; the rest is advice.
  - **_Verified end to end with a real token, by hand._** core-api will not issue a change-password
    token through `issue-restricted-token` ("Password change tokens can only be issued through the
    password reset endpoint") and the only real one is mailed, which this deployment cannot send
    (Q-007) -- so one was minted with the instance's own `JWT_SECRET`, the way S-024 did. The whole
    flow ran on **`seed.filler.25`**, whose password was changed and then set back to the seeded
    value through the same form; both states were checked by logging in against core-api, and the
    used token was confirmed dead afterwards ("Your access token was revoked").
  - _Its spec covers everything that does not need a real token_ -- the neutral answer, the
    forwarding, the missing-token state, a refused score, mismatched confirmations, and core-api's
    own message for a token it will not accept.
  - _Verified live in both locales._
  - _Observations:_ **186 e2e tests pass** (181 before), 76 unit tests (72 before).

- **[2026-09-01 20:55] A-006:** Confirming an address, and the nudge to do it.
  `app/[locale]/(anon)/email-verification/page.tsx`,
  `components/auth/{verify-email,resend-verification}.tsx`,
  `app/api/auth/email-verification/{route,resend/route}.ts`.
  - _core-api's own template is `"%webapp.address%/email-verification?{token}"`,_ which is this
    route exactly -- so unlike A-005's link, nothing has to forward it. The token is the whole
    query string again, read by `readQueryToken`.
  - **_Confirming is a click, not something opening the link does._** The legacy page verifies on
    load; this one does not, because the link lands in an inbox and mail clients, link scanners and
    prefetchers open links by themselves. A confirmation that happens because a scanner looked at
    the message is a confirmation nobody made.
  - _The token is the identity for that one call and never a session:_ core-api's action is
    `@LoggedIn` and reads the **token's** own user and `email` payload, checking that the address
    it was issued for is still the account's.
  - _The legacy dashboard's `NotVerifiedEmailCallout` is here too_, with the resend button, and it
    says what an unconfirmed address actually costs: ReCodEx keeps mailing there, so it means
    silence, not a locked account. Nothing in the product is withheld for it, and pretending
    otherwise would be inventing a rule core-api does not have.
  - **_Verified live, both halves._** The confirmation was driven end to end with a real
    `email-verification` token minted from the instance's own key (the same method A-005 used):
    `seed.filler.25` went from `isVerified: false` to `true` through the BFF route. **That one is
    not undoable** -- core-api has no endpoint that un-verifies an address -- so it was done on a
    filler account rather than on a seeded persona, and every seeded account is still unverified,
    which is what keeps the dashboard's callout visible to look at.
  - _The resend button's failure is core-api's own sentence_ ("Email cannot be sent, please try it
    later.") on this deployment, because its SMTP host is `smtp.example.com` (Q-007). The spec
    asserts exactly that: the reader is told, rather than left with a button that seems to have
    worked.
  - _Observations:_ **189 e2e tests pass** (186 before), 76 unit tests.

- **[2026-09-01 21:25] A-008:** Reading the app in the other language.
  `components/app-shell/locale-switch.tsx`, in the sidebar and in the `(anon)` layout.
  - _Two links rather than a control,_ because `localePrefix: "always"` already gives every page
    one address per language -- so the choice is a URL somebody can send or bookmark, and
    next-intl's own `NEXT_LOCALE` cookie (which its `Link` sets on the way) is what makes it stick
    for `/` and for the next visit.
  - _The path **and the query** are kept,_ so switching language translates the page you are on
    rather than sending you home -- which matters in an app that keeps its filters, tabs and pages
    in the URL, as most of these screens do.
  - _It is in the `(anon)` layout too:_ a visitor has no sidebar, and the sign-in page is exactly
    where somebody who reads Czech should be able to say so.
  - **_Its landmark is called "interface language", and that is a fix, not a flourish._** Labelled
    "language" it made `getByLabel("Language")` match two things -- this nav and the submit form's
    own runtime field -- which broke two shipped specs. Playwright matches labels by substring, so
    those two now ask for the field exactly; a screen-reader user would have met the same
    ambiguity, and the rename is what removes it.
  - _Observations:_ **191 e2e tests pass** (189 before), 76 unit tests.

- **[2026-09-01 22:05] A-003:** An account of one's own, where the instance allows it.
  `app/[locale]/(anon)/register/page.tsx`, `components/auth/register-form.tsx`,
  `app/api/auth/{register,registration-check}/route.ts`, `lib/auth/registration.ts`.
  - **_Whether this page has a form on it is a deployment's choice, and core-api will not say which
    (Q-019)._** `localRegistration.enabled` decides it server-side and no endpoint reports it --
    checked against the whole spec -- so this app carries `ALLOW_LOCAL_REGISTRATION`, exactly as
    the legacy frontend carries the same variable. **It is off here**, so the page explains rather
    than offering a form core-api would refuse, and the sign-in page does not link to it: an
    instance that authenticates through CAS has no use for one, and a form that always fails is
    worse than a sentence.
  - **_A name collision is a question, not a failure._** core-api answers a registration with
    `{user: null, usersWithSameName}` and a **200** when somebody with the same first and last name
    already exists in the instance -- it is asking whether one of them is this person. The form
    shows who they are and offers to carry on, which sends `ignoreNameCollision` the second time.
    Treating that as an error would strand somebody behind a name they cannot change.
  - _Two things are asked of core-api while the form is being filled in,_ from one public endpoint
    (`users/validate-registration-data`): whether the address is free, and how strong the password
    is. Telling somebody their address is taken before they have chosen a password is the
    difference between a hint and a rejection.
  - **_A bug this ticket's own verification found:_** the page was **statically prerendered**, so
    the build baked in whichever `ALLOW_LOCAL_REGISTRATION` the _builder_ had -- turning the flag
    on at run time changed nothing. It is `force-dynamic` now, which is what a page whose content
    is deployment configuration has to be.
  - _Verified live both ways:_ closed (this deployment's real state, which is what the spec
    asserts), and open via `ALLOW_LOCAL_REGISTRATION=true` -- the form renders with the instance
    from `/v1/instances`, "That address already has an account here." and "Very strong." appear
    while typing, and submitting meets core-api's own refusal. **The success path and the
    collision branch cannot be exercised here at all** (Q-019); re-verify them on an instance with
    registration enabled.
  - _Observations:_ **193 e2e tests pass** (191 before), 76 unit tests.

- **[2026-09-01 20:30] T-009:** The exercise configuration editor -- tests, languages, and what each
  test does. `app/[locale]/(app)/exercises/[exerciseId]/edit-config/page.tsx`,
  `lib/exercise-config/`, `lib/api/exercise-config.ts`, `lib/actions/exercise-config.ts`,
  `components/exercises/config/`.
  - _The brief calls this the hardest screen in the product, and the reason turns out to be
    ordering._ There are three saves and each one invalidates the next: a test rename changes the
    test's **id** (core-api copies a test rather than updating it and rewrites the configuration to
    point at the copy), and adding a language adds a whole branch of the configuration. So the
    screen is three forms in dependency order, each refreshing the page after it saves, and the
    third is not rendered at all without the first two -- with the reason named, rather than a form
    whose every select is empty.
  - **_What each test offers is read off the instance's pipelines, not assumed._** `parameters` on
    a pipeline (`hasEntryPoint`, `hasSuccessExitCodes`, `isCompilationPipeline`, ...) is the one
    part of this contract core-api publishes, and it is enough: Java's pipelines declare no entry
    point and C's take no jar files, so neither field is offered there. Everything else -- which
    variables exist, what they mean, the nine built-in judges -- is published nowhere and had to be
    ported from the legacy `configSimple.js` descriptor table. **Q-020 filed:** all five endpoints
    this screen uses are `"Placeholder response"` in the OpenAPI description, with no schema at all.
  - **_Reading is permissive, writing normalises, and unknown variables survive._** The reader
    ignores the pipeline filters and takes the first variable of each name it finds, so a
    configuration written by hand or by the legacy advanced editor still loads; the writer rebuilds
    the pipeline list from the instance's catalogue and places each variable where a pipeline
    declares it. Saving is therefore **not** a no-op. What keeps that from being destructive is
    that the merge starts from the variables already in the pipeline (DEC-102).
  - _Verified as a real round trip against the live API_, not only in unit tests: a two-environment
    exercise (Java + C++, two tests, compiler arguments, jar files, exit-code ranges, an
    output-file test) read, written, re-read -- identical, and core-api's own validator raised
    nothing about the configuration. The scratch exercise was deleted afterwards, along with four
    left behind by earlier failed spec runs; the instance is back to its 24 seeded exercises.
  - **_Two things this screen deliberately does not touch, both now tickets._** An
    `advancedExerciseConfig` is built from hand-picked pipelines, and rewriting one through this
    form would silently replace them -- so it is left alone and says so, **with the refusal in the
    Server Action as well as the UI**, because here the boundary has to be this app's: core-api has
    no rule against it (DEC-101, T-024). A `universal` score is an expression tree this app cannot
    write back, so an exercise using one keeps it and is offered no switch away -- offering one
    would be a door out of a state nothing here could restore (DEC-103, T-025).
  - _One accessibility fix found by writing the spec:_ a `<select>` wrapped in its own `<label>`
    takes the **whole** label -- every option's text included -- as its accessible name. Every
    control in these forms now names itself explicitly.
  - _T-021's exercise screen links here_, which is the DEC-066 rule paying out for the second time.
  - _Observations:_ **197 e2e tests pass** (193 before), **99 unit tests** (76 before), both locales
    rendered and checked.

- **[2026-09-02 06:05] T-010:** An exercise's resource limits -- which machines, and how much on
  them. `app/[locale]/(app)/exercises/[exerciseId]/edit-limits/page.tsx`,
  `lib/exercise-config/limits.ts`, `lib/api/exercise-limits.ts`, `lib/actions/exercise-limits.ts`,
  `components/exercises/config/{limits-form,hardware-groups-form}.tsx`.
  - _Two questions in order, and the first is the one that unblocks an exercise._ A hardware group
    is core-api's description of a class of worker, and an exercise with none of them is
    `@no-hwgroups` -- the last of the four reasons a freshly created exercise calls itself broken,
    and now answerable from this app. T-009 answered the other three.
  - **_Which of the two time measures an exercise uses is inferred, then offered as a switch._**
    core-api stores either `wall-time` or `cpu-time` and never says which the exercise _means_, so
    the legacy heuristic is reproduced -- whichever key more limits carry, processor time on a tie
    -- and then made a visible control, because flipping it rewrites every cell into the other key.
    Reading also falls back to the _other_ key when only it is set, so a limit written the other
    way is shown rather than read as zero and lost on the next save.
  - **_The one form in this app that is not React Hook Form_** (DEC-104). Its fields are a grid
    whose shape is data, its three copy controls each write a whole row, column or grid, and the
    thing that actually gets a save refused is not any single cell but the **sum of a column** -- a
    machine caps the time of one test and of the whole exercise in one language. So validation is a
    pure function over the whole grid, shown as marked fields plus a running total per language,
    and re-run in the Server Action against ceilings read fresh rather than taken from the client.
  - _The tightest ceiling wins_ where an exercise runs on several machines, because the limits have
    to hold on all of them. This deployment has exactly one hardware group, so the combining is
    unit-tested rather than seen.
  - _The exercise screen and the configuration screen link here_; the limits screen links back.
  - _Observations:_ **200 e2e tests pass** (197 before), **116 unit tests** (99 before).

- **[2026-09-02 06:20] T-023:** An exercise's own files, the links into them, its people, and
  copying it. `components/exercises/{exercise-files,exercise-people}.tsx`,
  `lib/api/exercise-files.ts`, `lib/actions/{exercise-files,exercise-people}.ts`,
  `lib/i18n-text/file-links.ts`, `app/api/exercises/[exerciseId]/files/route.ts`.
  - **_The files were the load-bearing half._** T-009's configuration editor points every one of
    its file fields at this list, so an exercise created in this app had nothing to select and the
    screen said so. It can now be taken from created to configured to assignable without leaving
    here. The upload is S-014's chunked Route Handler, not a Server Action (brief §6.7).
  - _Attaching is additive and a name is an identity._ core-api keeps what is already attached and
    replaces only a file of the same name, **carrying that file's links over to the replacement**
    -- so uploading a corrected `expected.txt` fixes the exercise rather than breaking every link
    into it. Nothing here sends the whole set, which is how one would delete a colleague's upload.
  - **_`%%key%%` placeholders now resolve_** (DEC-105), which `INVENTORY.md` had listed as a gap
    since T-008. The substitution is on the string, before parsing -- a placeholder can stand
    inside a link target -- and the trap it creates is the reason it is a decision: the settings
    form is bound to a separate **unresolved** copy of the texts, or saving would write the
    substituted URLs over the author's own placeholders. A placeholder with no link stays visible.
  - _Deleting a file confirms and says what it costs_: core-api lets the file go and the
    configuration keeps the name, which is a test that fails at evaluation time with nothing on
    screen to point at.
  - **_Who may be an administrator is core-api's rule and is not guessed here._** It refuses a
    plain student ("Given user is not allowed to be administrator of an exercise") and that
    sentence is shown as it came -- pre-filtering the offer by role name is what constraint 4
    forbids. Handing the exercise over is separate from adding administrators because core-api
    grants the two separately, and it confirms: the outgoing author may not be able to undo it.
  - _Forking is a copy, not a link_, and lands on the copy's own settings. The two exercises have
    no relationship afterwards beyond the `forkedFrom` id T-021's screen already named.
  - _One existing spec needed scoping, not fixing:_ T-008's reached for a group name that the new
    "Copy into" select now also lists.
  - _Observations:_ **203 e2e tests pass** (200 before), **120 unit tests** (116 before).

- **[2026-09-02 06:35] T-012:** Where an exercise is assigned, and assigning it several places at
  once. `app/[locale]/(app)/exercises/[exerciseId]/assignments/page.tsx`,
  `lib/api/exercise-assignments.ts`, `lib/actions/exercise-assign.ts`,
  `components/exercises/exercise-assignments.tsx`.
  - _T-021 counts them; this is the list behind the number._ It earns its own screen because **an
    assignment is a snapshot**: editing an exercise changes nothing already assigned from it. So
    the useful question after a round of edits is not "what did I write" but "who is now out of
    date", and each row answers it -- through the same `stalePartsOf` rule S-013's notice uses,
    exported rather than reimplemented. Re-synchronising stays on T-002's screen, where the button
    that does it already is.
  - **_Assigning to several groups at once, with each one standing on its own._** core-api has no
    bulk call, so this is one request per group; a reader who may create in four of the five they
    picked gets four assignments and one named refusal, rather than an error that hides what
    worked. Groups that already have an assignment from this exercise are still offered and marked,
    because assigning one twice in a group is legitimate and core-api allows it.
  - _Observations:_ **206 e2e tests pass** (203 before), 120 unit tests.

- **[2026-09-02 06:50] T-011:** An exercise's reference solutions -- the answers that prove it is
  possible. `app/[locale]/(app)/exercises/[exerciseId]/reference-solutions/`,
  `lib/api/reference-solutions.ts`, `lib/actions/reference-solutions.ts`,
  `components/exercises/{reference-solutions-table,reference-solution-submit}.tsx`.
  - _A reference solution is the author's own answer run through the pipeline a student's would be_,
    and core-api will not let an exercise be assigned without one -- the fifth refusal T-001's
    picker could only meet on the attempt (DEC-097). This is where it gets answered.
  - **_The results table is S-015's component, unchanged._** It was widened to take the two fields
    it actually reads rather than a whole `SolutionDetail`, because a reference solution has none
    of the rest of one -- no attempt index, no points, no review -- and synthesising a fake
    assignment solution to reuse the shared part would have been the wrong kind of clever. The
    claim the reuse makes is the true one: a reference run **is** the exercise's own configuration
    executed for real.
  - **_Found live, and it changed the screen: the list is filtered one solution at a time._**
    `canViewDetail` runs per row, so a supervisor sees an empty array for an exercise that plainly
    has reference solutions and is assignable. The obvious empty state would have been a plain
    falsehood; `hasReferenceSolutions` on the exercise is not filtered and is what separates
    "nobody has written one" from "none of them is yours to read" (DEC-106).
  - _Re-evaluating all of them is the screen's real work._ A reference solution proves the
    configuration works, and the proof goes stale the moment the configuration changes -- one call
    after editing the tests is how an author finds out whether they have broken their own exercise.
  - _Visibility is a three-level scale_ -- private, students too, or the canonical answer -- not a
    switch: "students can read this" and "this is the answer" are different claims.
  - _Submitting reuses S-014's two-step:_ `pre-submit` asks core-api what the uploaded files are
    before anything runs, so the language is reported rather than guessed, and files no configured
    language claims are refused **before** submission rather than after.
  - _Observations:_ **209 e2e tests pass** (206 before), 120 unit tests. Every reference solution on
    this deployment reports an infrastructure failure (DEC-031), which is what the spec asserts.

- **[2026-09-02 07:20] T-013 + T-014:** The instance's pipelines, and one of them drawn.
  `app/[locale]/(app)/pipelines/`, `lib/api/pipelines.ts`, `lib/pipelines/{types,layout,svg}.ts`,
  `components/pipelines/pipeline-graph.tsx`.
  - _A pipeline is the machinery an exercise's tests run on_, and most people never come here: an
    author picks from what the instance offers, which is what T-009's editor does for them. So the
    list leads with each pipeline's **parameters** -- the flags T-009 reads to decide which fields a
    test offers -- rather than with dates.
  - **_The payload has no edges._** Boxes name variables on their ports, and two boxes are connected
    exactly when one writes what another reads; the graph has to be derived. A table of boxes with a
    column of variable names is the same information in the form in which nobody can see the shape,
    which is why the picture comes first and the tables second.
  - **_The brief's "decide early" about pipeline visualisation, decided -- and not the way it was
    going to be_** (DEC-107). Server-side Graphviz was the plan and was implemented; then
    `@viz-js/viz@3.30.0` (Graphviz 16.0.0) crashed on the seeded Python pipeline with
    `RuntimeError: table index is out of bounds`. Reduced to plain synthetic input: **ten record
    nodes with an empty leading cell crash it, five do not** -- the exact label shape the legacy
    renderer emits, and a size threshold rather than a syntax error, so every realistic pipeline is
    a coin toss. So the layout is now this app's own pure function and the drawing is string
    building, both on the server, both unit-tested. Two things came free: the colours are design
    tokens, so the diagram is themed like everything else instead of being a pale-green picture on
    a dark page, and every node carries `data-name`, so selection will not need the legacy click
    handler's trick of parsing generated markup for `<title>` elements.
  - _Layering is as-late-as-possible._ The obvious rule puts every source in layer 0, and a ReCodEx
    pipeline is nearly all sources -- a dozen `file-in` boxes feeding one execution box -- which
    draws a mile-wide row above a two-node column. Working back from the sinks lowered the seeded
    graph from 2075px wide to 1507px, and adding the **port's** own position to the barycentre key
    took the long crossing edges from 8 to 5: without it every producer of the same box scores
    identically and keeps whatever order it arrived in.
  - _One filter is honestly local._ core-api's pipeline endpoint knows `search`, `exerciseId` and
    `authorId` and nothing about languages, so the language filter narrows the page in hand -- and
    says so, rather than implying it narrowed the list.
  - _Observations:_ **212 e2e tests pass** (209 before), **138 unit tests** (120 before).

- **[2026-09-02 07:50] T-015 + T-016:** Editing a pipeline, and editing how it is wired.
  `app/[locale]/(app)/pipelines/[pipelineId]/edit/page.tsx`,
  `components/pipelines/{pipeline-settings,structure-editor}.tsx`,
  `lib/actions/pipeline{,.schema}.ts`.
  - _One screen, not two, because core-api's `updatePipeline` replaces the whole entity_ -- the
    legacy app's `EditPipeline` and `EditPipelineStructure` would each have to carry the other's
    state through a round trip to avoid wiping it. Each save here re-reads the other half.
  - **_The graph is redrawn as you edit_**, by the same pure functions the read-only screen renders
    on the server (DEC-107). One implementation, no WebAssembly, and the preview is what makes a
    wiring mistake visible before it is saved.
  - **_A port is wired by choosing a variable, never by typing a name_** -- filtered to the port's
    own data type. This is the single most useful thing on the screen: a pipeline connects boxes by
    _name matching_, so a typo is not an error, it is a wire that quietly is not there. Renaming a
    variable rewires every port that named it, for the same reason.
  - **_Two of core-api's rules are about the graph, and both were found by breaking them:_** a
    variable may be written by **at most one** port (`Multiple ports output variable ...`) and must
    be read by **at least one** (`No port uses variable ...`). Neither is a property of a field, so
    neither could be a field's validation; both now block the save with the offending names listed.
    A variable that is only _read_ is fine and is the normal case -- that is what an external
    reference is.
  - _An unwired port is advice, not an error_: core-api stores one happily, and the editor says
    what will simply not happen rather than refusing.
  - **_This ticket damaged the deployment and the repair is the lesson._** The spec forked a
    pipeline and typed into the next field before `router.push` had navigated, so two saves landed
    on the **seeded** pipelines instead of the copies; cleaning up afterwards then deleted two of
    them. Both were recovered -- core-api's delete is a soft one, so `deleted_at = NULL` in the
    database brought them back with their original ids and their supplementary files intact, which
    recreating them could not have done (`runner.py` is attached to the pipeline and a new one has
    no way to adopt an existing upload). All fifteen pipelines are now byte-identical to the
    snapshot taken before this session. The spec has an `openCopy` helper that will not touch a
    field until the address has actually changed to a different pipeline, and an `afterEach` that
    removes every copy even when a test dies first -- the suite's first write helper against
    core-api, and worth it.
  - _One pre-existing flake fixed on the way:_ the ZIP-submission spec (S-017) does ~17s of real
    work and began timing out at the default 30s now that two hundred tests share this machine's
    core-api. `test.slow()`, with the reason written down.
  - _Observations:_ **215 e2e tests pass** (212 before), 138 unit tests.

- **[2026-09-02 08:30] T-024:** The other kind of exercise configuration, and the way back out of
  it. `components/exercises/config/advanced-config.tsx`, `lib/exercise-config/advanced-config.ts`,
  `lib/actions/exercise-advanced.ts`.
  - _An `advancedExerciseConfig` is one language, one pipeline list shared by every test, and every
    variable those pipelines ask for filled in by hand._ **Which variables those are is core-api's
    answer** (`POST /config/variables`), not a vocabulary this app carries -- which is the whole
    reason this editor could be built without a second copy of the descriptor table T-009 needs.
  - **_The switch exists in both directions now, and only one of them confirms_** (DEC-108).
    DEC-101 made T-009 refuse to rewrite an advanced configuration, which was right and left an
    exercise in that state with no way out of this app -- the one-way door S-026 and T-001 were
    each filed for. Going _to_ advanced sets a flag and keeps the configuration, so nothing is
    asked; coming _back_ rebuilds it, so the dialog **names the variables and pipelines that will
    actually go**, read from the exercise. "Something may be lost" is not a warning anybody can act
    on.
  - **_Found and fixed a latent defect in T-009's writer_** (DEC-102, corrected). It carried
    forward every variable already in a pipeline, on the reasoning that this app's vocabulary
    should not be the ceiling. core-api disagrees: it refuses a configuration holding a variable
    the pipeline does not declare -- `Variable 'extra-files' is redundant in pipeline ...` -- which
    surfaced the first time the switch back wrote one. The writer now asks what each pipeline
    declares and writes exactly that: the form's value where the vocabulary covers it, the stored
    value where name and type still match, the pipeline's default otherwise. The intent survives,
    but the ceiling is the pipeline's rather than this app's, which is where it belonged.
  - _The editor is keyed by its two structural choices_ -- the language and the pipeline list --
    because saving either rebuilds the configuration on core-api's side, the same reason T-016's
    structure editor is keyed by its version. Saving the _values_ leaves the key alone, so nothing
    just typed is thrown away.
  - _Verified as a real round trip_: an exercise taken to a configuration of its own, given a
    pipeline and a judge, brought back to the standard form, and the judge still there -- because
    `judge-type` is one variable both vocabularies know.
  - _Observations:_ **217 e2e tests pass** (215 before), **152 unit tests** (138 before).

- **[2026-09-02 08:50] T-025:** A score of one's own, written as an expression.
  `lib/exercise-config/score-expression.ts`, `lib/actions/exercise-score.ts`,
  `components/exercises/config/score-expression.tsx`.
  - **_Edited as text, not as a tree_** (DEC-109). core-api's `universal` calculator stores an
    expression tree of eleven node types; the legacy app edits that tree _with_ a tree, in about
    three thousand lines of node forms and drag targets. This ships a grammar instead -- infix
    arithmetic, six functions, and a test result written as its name in quotes -- whose parser and
    printer are two pure functions with a round-trip test. An expression can also be read at a
    glance and pasted between exercises, which a tree cannot.
  - **_Two failures, checked separately, because they are different things._** The syntax is the
    parser's, and it says which character it gave up at. A test name is checked against the
    exercise's own tests: a misspelt one is not a syntax error, it is an exercise graded on
    something that does not exist, and core-api's refusal names the calculator rather than the
    word. The save is not offered until both are clean.
  - _Switching in is lossless and switching out says what it costs._ Coming to the expression seeds
    it from what the exercise already does -- equal weights an average, unequal ones the sum over
    the total -- so it grades exactly as before. Going back **names the weights the expression
    becomes** where it is one of those two shapes, and says it will be lost where it is not;
    guessing at a general expression would be re-deriving algebra, and a wrong guess silently
    rewrites how a live exercise is graded. **This supersedes DEC-103**, which was right only for
    as long as this app could not write an expression back.
  - **_Two latent bugs found on the way._** The configuration page **crashed** when a weighted
    score's `{testWeights}` reached the expression printer -- a `useState` initialiser runs before
    the component's early return, so "only render this when universal" was not enough. And the
    tests form kept the ids it mounted with across a save, which for renamed tests means sending
    `id: null` for tests that exist; it is keyed by what core-api holds now, like the other three
    editors this session added.
  - _Observations:_ **219 e2e tests pass** (217 before), **170 unit tests** (152 before).

- **[2026-09-02 09:40] T-022:** Discussion threads -- the last open parity gap.
  `lib/api/comments.ts`, `lib/actions/comments.ts`,
  `components/comments/{discussion,comment-thread}.tsx`, on six screens over four threads.
  - **_A thread's id is the id of the thing being discussed._** `/v1/comments/{exerciseId}` _is_
    the exercise's discussion, and core-api creates the thread the first time anybody reads or
    writes it -- so there is nothing to create, no "start a discussion" control, and an entity
    nobody has talked about simply has an empty thread.
  - **_"Private" is stronger than most people will expect, so the checkbox says what it means._**
    core-api filters a private comment out of everybody else's copy of the thread
    (`filterPublic($user)`), so it is a note in the margin rather than a quiet word with the staff
    -- this app never has to hide one and could not leak one if it tried. What _public_ reaches
    differs by screen, so each mount point supplies that sentence in its own words.
  - _Deleting and unhiding are offered where there is a basis._ core-api's rule is `isAuthor` **or**
    supervising the group of the commented solution or assignment, and **no hint for it rides on a
    comment** -- so the controls appear on the reader's own comments always, and on everybody's
    where the screen already knows the reader teaches there. DEC-090's shape for the fifth time.
  - _Uses `/private` rather than the `/toggle` the legacy app calls_, which core-api marks
    deprecated: sending the value you want is not the same as flipping whatever is there.
  - _Six mounts, four threads:_ the exercise; the assignment, whose thread the solutions list also
    shows (as legacy does -- a teacher reading every attempt is exactly who wants it); a solution,
    whose thread its sources page also shows; and a reference solution. **Not** S-018's inline
    review comments, which `INVENTORY.md` had confused this with and which are attached to a line.
  - _Found and swept on the way:_ three invisible assignments left behind by T-012's spec when runs
    were interrupted. An assignment made from a seeded exercise **inherits that exercise's name**,
    so a name-based sweep cannot see one -- that spec now records what it creates and removes it in
    an `afterEach`, like T-015's.
  - _Observations:_ **221 e2e tests pass** (219 before), 170 unit tests.

- **[2026-09-02 11:50] AD-001:** Everybody the instance knows, and what can be done about an
  account. `app/[locale]/(app)/users/page.tsx`, `lib/api/users.ts`, `lib/actions/users.ts`,
  `components/users/{user-table,user-row-actions,create-user}.tsx`. **The Admin phase opens.**
  - **_Who may read this screen and who may act on it are two different audiences, and the split is
    core-api's own._** `user.viewAll` is granted from the `supervisor` role upwards, so a plain
    supervisor reads the whole directory; `setIsAllowed`, `delete` and `create` fall under
    `permissions.neon`'s blanket `role: superadmin` allow. **A `supervisor-student` is refused the
    screen outright** -- that role inherits only `viewList` from student and never gains `viewAll`
    -- which is not what "teachers see the user list" would have predicted. Verified live in all
    four directions rather than read off the config.
  - **_A user carries no `permissionHints` at all, so the actions are offered on the reader's role_**
    (DEC-110). DEC-080 found the field `null` on `/v1/users/{id}` for S-021; the list payload is the
    same, and `permissionHints` turns out to be emitted for exactly one entity in the entire API
    (`GroupFormat`). What keeps this honest is that the Server Actions call core-api on the
    **caller's own token** -- the button and the forged call meet the identical check -- so the role
    decides what is _offered_ and core-api still decides what _happens_.
  - _Everything that narrows or reorders the list is a URL and a round trip_, T-020's trade again
    (DEC-097): search, five role checkboxes, three sortable columns and paging are all core-api's,
    so the filters are a plain `GET` form, the sort controls are links, and no part of the screen
    needs JavaScript. **The `orderBy` whitelist fails silently the way the `filters` one does** --
    `orderBy=bogus` answers HTTP 200 with the rows in arbitrary order, not an error -- so this app
    sends only the three columns `Users::getPaginated` actually knows.
  - _One search box, because core-api searches both halves:_ `firstName`, `lastName` **and**
    `email`, which is what an administrator arrives holding.
  - _The two per-account rules core-api adds on top are restated where they are visible._
    `checkSetAllowed` refuses the flag on one's own account, so the reader's own row has no Disable
    button at all; `checkDelete` has no such exemption, and the legacy app offers deletion there
    too, so it stays -- with a confirmation that names the person, which is what makes one's own row
    look different at the moment it matters.
  - **_Deleting anonymises rather than erases, and the confirmation says so._** core-api runs
    `prepareUserForSoftDelete` first: the name, the address and the external identities go, the
    solutions and the points they earned stay, attached to nobody. "Delete" on its own would promise
    both more and less than that.
  - **_Creating a user works here precisely because registration is closed._**
    `checkCreateAccount` demands `user.create` only when local registration is disabled, which is
    this deployment (A-003) -- so the same endpoint that serves nobody anonymously serves the
    administrator. The new account is always a **student** (core-api hardcodes it; changing that is
    AD-002's `setRole`), lands in the administrator's own first instance (the legacy
    `selectedInstanceId`, restated), and the access token core-api hands back is **dropped** --
    signing the administrator in as the person they just created is the accident to avoid.
  - _A name collision is a question, not a failure_ -- `{user: null, usersWithSameName}` with a 200
    -- so the dialog names who it found and offers to go on, which is A-003's handling of the same
    answer from the other side of the desk.
  - **_Found and filed as Q-021: an address that has been deleted once can never be deleted again._**
    Anonymisation appends one fixed `@deleted.recodex` suffix to a column whose unique index still
    covers soft-deleted rows, so the second delete of a re-created address dies as
    `UniqueConstraintViolationException` and shows the administrator a Doctrine class name. Found by
    this ticket's own spec on its **second** run, reproduced straight against core-api with `curl`,
    and cleared by renaming the account before deleting it. The spec now mints a per-run address --
    a workaround for the test, not for the product, which is why it is a question and not a note.
  - _Dropped a badge after seeing it render._ An "Email not verified" flag was on the first version
    of every row and, on an instance that has never had working mail, on all thirty-one of them --
    two lines per row to say nothing. It is on the profile screen, where it means something.
  - _Small cleanup rather than a third copy:_ S-022's local `Field` moved into the form kit
    (`components/form/field.tsx`), where the errors whose message is a translation key belong; it is
    now shared instead of duplicated.
  - _Observations:_ **229 e2e tests pass** (221 before), 170 unit tests.

- **[2026-09-02 13:20] AD-002:** Somebody else's account, as an administrator changes it.
  `app/[locale]/(app)/users/[userId]/edit/page.tsx`, `components/users/user-admin-forms.tsx`,
  `lib/api/user-roles.ts`, three more actions in `lib/actions/users.ts`.
  - **_Half of this ticket turned out to be shipped already._** "User detail -- info, groups,
    solutions" is S-021, built in the Student phase and reachable from every name in the app. What
    was actually open was the sentence after it: **editing _another_ user's account**, which S-022
    deliberately left here when it built the same forms for oneself. So this ticket is the legacy
    `EditUser` page seen from the half nobody had built -- the third time a Teacher/Admin ticket has
    turned out to be partly done (T-004 with S-013, T-017 with S-020).
  - **_Editing oneself redirects to one's own settings rather than hiding controls_** (DEC-111).
    The legacy page is one screen with four `id === loggedUserId` branches, and the branches exist
    because core-api draws the line in four places. Three of them are hard refusals: `checkSetRole`
    and `checkSetAllowed` each refuse the _current user_ before the ACL runs, and a **forced**
    password change on oneself is refused by an `allow: false` rule sitting **above** the
    superadmin's blanket allow in `permissions.neon`. That last one was confirmed by asking -- a
    superadmin sending no old password for their own account gets `400-103 "Your current password
does not match"`, which is a confusing sentence for a request that contained no password to not
    match -- rather than by trusting the rule ordering in a file.
  - **_Two sections are missing because core-api will not disclose them, not because they were
    dropped._** `settings` and `uiData` reach `privateData` only for the account's owner (verified
    live: both absent when a superadmin reads a student), so notification preferences and the iCal
    tokens cannot be shown here by anybody. The legacy screen hides them for the same reason.
  - _The name-and-email form is S-022's, unchanged._ `updateProfile` is the same call whoever makes
    it and the action already took a `userId`, so the only work was rewording two strings out of the
    first person ("Use my Gravatar picture", "Your profile was saved") so they are true on both
    screens. What is genuinely new is the role, a password set without knowing the old one, ending
    every session, and adding a local login to an account that signs in only through an external
    service.
  - _Setting somebody's password does **not** sign the administrator out_, which is the half of it
    that is easy to get wrong: the validity threshold core-api stamps belongs to the edited account.
    Confirmed live -- the response carries no refreshed token at all -- and S-022's form, which
    _does_ end with a sign-out, is left alone.
  - _`USER_ROLES` moved out of `lib/api/users.ts` into `lib/api/user-roles.ts`._ That module is
    `server-only`, and the role vocabulary is now needed by a Zod schema a client component
    imports; a `server-only` import reaching `"use client"` fails the build, which is the right
    failure and the reason the constant now has a plain module of its own.
  - _Two bugs found by verifying rather than by reading._ The self-redirect used `next/navigation`'s
    `redirect`, which drops the locale prefix and rendered a blank page -- next-intl's own
    (`{href, locale}`) is what this app has. And the first spec asked for the role select by label,
    which matched the **section** instead: `<section aria-labelledby>` gives the section that
    accessible name too.
  - **_One reworded string took down two specs, and only one of them was about the string._**
    Neutralising "Your profile was saved" broke `account.spec.ts`'s assertion -- expected -- but
    that spec sets the seeded student's title to "Bc." and puts it back **in the same test**, so
    failing halfway left her named "Bc. Alice Student" in the database. `points-export.spec.ts`
    looks that name up in a downloaded CSV and failed on data, not on code, one spec away from the
    change. The name was put back, and that spec now restores the field in a `finally` so a failure
    there costs one red test rather than two.
  - _Observations:_ **235 e2e tests pass** (229 before), 170 unit tests.

- **[2026-09-02 14:10] AD-003:** Signing in as somebody else. `components/users/takeover-button.tsx`,
  on S-021's profile screen. The BFF route was already F-020's, so this ticket is the control and
  the sentence next to it.
  - **_There is no impersonation mode, because core-api does not make one._** `actionTakeOver`
    calls the same `sendAccessTokenResponse` that login does -- an ordinary master+refresh token for
    the target, carrying **nothing** that says whose doing it was. Read directly rather than
    inferred. So there is no banner this app could honestly render and no token it could swap back;
    what it has instead is a confirmation that says the true thing: "this is a sign-in, not a
    preview... the way back is to sign out and sign in again as yourself" (DEC-112).
  - **_It lands with a full page load, not `router.push`._** The session cookie now identifies a
    different person while Next's client Router Cache still holds RSC payloads rendered for the
    administrator. Every server read here is `no-store` precisely so one user's data cannot reach
    another (DEC-021, brief §6.3's "a cross-user cache leak is a security incident"), and throwing
    the client away is the one-line way to keep that true on the client too. It is also the one
    place in this repo where `@next/next/no-location-assign-relative-destination` is deliberately
    suppressed, with the reason written next to it.
  - _Three conditions, and only two of them are core-api's._ A superadmin (its `takeOver` grant,
    with an explicit `allow: false` underneath for everybody else), never oneself, and **never a
    disabled account** -- that last one core-api would happily answer, but the token it issued
    would be refused at every turn, so offering it is offering a dead end.
  - _On the profile only, where legacy also puts it on the user list._ Every name in the app links
    to the profile, and the profile is where the reader can see who they are about to become; a
    one-click sign-in-as-somebody-else in a list of thirty rows is a misclick waiting to happen.
  - **_A "return to my account" was considered and deliberately not built_** (DEC-112's alternatives).
    It would need a second cookie holding the administrator's own token and a route to swap it back
    -- a real improvement, and the security argument against it is weak, since the browser held that
    token a moment earlier. But it is an auth-model change rather than "add the button", so it is
    written down rather than smuggled in.
  - _The proof is the sidebar._ A takeover is only real if the whole shell changes, so the spec
    asserts the Administration section is gone and `/users` answers with a refusal -- not that a
    button did something.
  - _Observations:_ **239 e2e tests pass** (235 before), 170 unit tests.

- **[2026-09-02 15:30] AD-004 + AD-005 + AD-008:** The instances, and what keeps them running.
  `app/[locale]/(app)/admin/instances/{page,[instanceId]/page}.tsx`, `lib/api/instances.ts`,
  `lib/actions/instances.ts`, `components/instances/{create-instance,instance-settings,licence-manager}.tsx`.
  **Three tickets, two screens** -- and that is not a shortcut, see below.
  - **_"Instance edit -- settings, limits" was wrong, and core-api says so in one line._**
    `POST /v1/instances/{id}`'s entire request body is `{isOpen}`. There are no limits and there is
    one setting, which is why the legacy `EditInstance` page is a **single checkbox**. **The reason
    is that an instance is mostly its root group wearing a hat**: the name and description shown
    everywhere are the group's, typed once at creation and edited afterwards through the group. So
    the legacy `Instance` and `EditInstance` pages merge into one screen that _links to_ that group
    rather than offering fields the endpoint would silently drop (DEC-113).
  - **_A revoke button was built, and then deleted when the spec caught it doing nothing_** (Q-022).
    core-api publishes `isValid` on a licence as an "administrator switch to toggle license
    validity"; `actionUpdateLicence` reads it as `$req->getPost("isValid") ? ... :
$licence->isValid()`, so **`false` is falsy, takes the else branch, and writes back what was
    already there** -- while `"false"` and `0` are rejected by the boolean validator first.
    Reproduced all three ways with `curl`. A licence can be set valid by any client and invalid by
    none. **This is why the legacy app renders a column called "Without revocation" and offers no
    way to change it** -- a consequence, not an oversight, and it took building the button to
    understand it.
  - **_`hasValidLicence` is not "one of the rows below is valid"._** core-api computes it as
    `needsLicence === false || validLicences > 0` and does **not** publish `needsLicence`, so the
    seeded instance reports itself covered with an empty licence table -- which on its own reads as
    a contradiction. The screen tells the two apart by inference (core-api says it is fine and
    nothing here could be the reason, therefore it needs none) and says which in words. Found by
    rendering it, not by reading the entity.
  - _The list is gated on the Admin section's audience, and the comment says that is not an
    authorisation claim._ `instance.viewAll` is granted to the **`unauthenticated`** role -- that is
    how A-003's registration form offers a choice of instance before anybody signs in -- so nothing
    here is secret. `/admin/*` simply has an audience (`IA.md` §3.1), and a student could open this
    route until it did. Found by opening it as one, mid-verification, while still signed in from
    AD-003's takeover.
  - _Deleting is never offered for the instance the reader's own account belongs to_, which is the
    only reason the e2e spec can exercise deletion at all: it creates its own instance, opens it,
    deletes it, and never touches the seeded one every other spec signs into.
  - _Cleanup in a `finally`, for the second time this session._ The run that caught the revoke
    button left the instance it had created behind. Unique names mean a leftover breaks no later
    run, but an instance list that grows a row every time a test fails is a mess somebody clears by
    hand -- so both mutating tests now delete their instance whatever their assertions do, the same
    guard `account.spec.ts` grew a few hours earlier.
  - _Observations:_ **245 e2e tests pass** (239 before), 170 unit tests.

- **[2026-09-02 16:40] AD-006:** The services underneath, and the one switch that stops them.
  `app/[locale]/(app)/admin/page.tsx`, `lib/api/server.ts`, `lib/actions/server.ts`,
  `components/admin/{broker-panel,async-jobs}.tsx`. The `/admin` placeholder is gone.
  - **_"Runtime environments, hardware groups" was wrong, and this time there is nothing behind
    it._** The legacy `ServerManagement` page contains neither -- it is the **ZeroMQ broker** and
    **core-api's background job queue**, two panels. And neither runtime environments nor hardware
    groups have an administration screen anywhere in that app: grepped, not assumed. They are
    read-only vocabularies that surface in the exercise configuration editor (T-009) and the limits
    editor (T-010), both already built. So there is nothing to port and no gap to file (DEC-114).
    Second backlog note this session that described a screen nobody had opened.
  - _Two details the screen decides for itself._ **Only the freeze that applies is offered** --
    `is-frozen` arrives in the statistics, so rendering both buttons would be offering an action
    that cannot apply. And **the statistic names are core-api's, untranslated**: it answers a flat
    map with no schema, and a table that renamed `idle-worker-count` into prose would go stale the
    first time the broker grows a counter.
  - _The freeze confirmation says what freezing costs_ rather than asking whether the reader is
    sure: evaluation stops for the whole deployment, students can still submit, and nobody is told
    why. **The e2e spec deliberately never confirms it** -- a test that died between freezing and
    unfreezing would leave the deployment swallowing submissions for every spec after it. It
    asserts the dialog and cancels.
  - _An empty job table means two things, and Ping is how they are told apart._ An idle deployment
    and a dead async handler look identical; a ping is an empty job whose only purpose is to come
    back finished. That one **is** exercised end to end.
  - **_Found by looking at a sidebar: deleting an instance orphans its root group_** (Q-023).
    `actionDeleteInstance` removes the instance row and stops, so AD-004's spec had quietly left
    eight groups named `e2e instance …` in the superadmin's "My teaching" list across four runs,
    while the instance list showed one row. Two consequences, and neither is "delete the group
    too": the delete confirmation now says what actually happens, because the obvious reading is
    wrong and being wrong about that in a destructive dialog is worse than the wart; and the spec
    removes the orphan through core-api in its teardown, the third `deleteXIfPresent` helper for
    the third reason of this kind. The eight strays were cleared from the deployment.
  - _Observations:_ **249 e2e tests pass** (245 before), 170 unit tests.

- **[2026-09-02 18:10] AD-007:** Telling everybody something at once. **The Admin phase is
  complete.** `app/[locale]/(app)/system-messages/page.tsx`, `lib/api/system-messages.ts`,
  `lib/actions/system-messages.ts`, `components/messages/{message-manager,active-messages}.tsx`,
  and a banner in the app shell.
  - **_The endpoints are `/v1/notifications`._** Nothing in `openapi/core-api.yaml` matches "system
    message" -- the module is called `systemMessages` and the paths are not, which is why finding
    them meant reading the legacy redux module rather than the spec. Two of them, answering
    different questions: `/all` is every message that exists (the management screen), `/` is the
    ones active **for this reader right now** (what the shell shows).
  - **_Both halves, because one without the other is nothing._** A screen that writes broadcasts
    nobody sees is not a feature. The legacy app hides active messages behind a bell in its header
    with an unread badge; **this shell has no header bar to hang one on**, and a broadcast is the
    instance saying evaluation is down -- worth reading without opening a dropdown. So they render
    across the top of every page (DEC-115).
  - **_"Read" is one timestamp, and it has to be._** core-api stores no per-message flag: the
    legacy app keeps a single `systemMessagesAccepted` in the reader's `uiData` and treats
    everything older as seen. So dismissing covers whatever is on screen and a later message comes
    back on its own -- inventing a per-message store would mean inventing storage core-api does not
    have. `POST /ui-data` merges by default, so the one key is written and the rest left alone.
  - **_`role` is a floor, not a target_**, which the label had to say: core-api's own words are
    "users with this role and its children", so `student` reaches everybody. Verified by addressing
    a message to `student` and finding it in the superadmin's own list.
  - **_Recorded rather than papered over: a capability nobody can reach._** `notification.create`
    is granted from the `supervisor` role up; `viewAll` -- the management list -- is the
    superadmin's alone. A supervisor may write a broadcast and then has nowhere to see, edit or
    withdraw it. Building them half a screen out of `/v1/notifications` was rejected: that endpoint
    answers what is _active for the reader_, not _what they wrote_, so it could offer neither
    editing nor withdrawal and would be a worse lie than its absence.
  - _Third module split out of a `server-only` file this session._ `MESSAGE_TYPES` had to move to
    `lib/api/message-types.ts` for the same reason `USER_ROLES` did: a client component and a
    shared Zod schema both need the vocabulary, and a `server-only` import reaching `"use client"`
    fails the build. It failed the build, which is the right failure.
  - _A parallel-safety mistake caught by the suite._ The first spec asserted "no banner" after
    removing its own message -- but three of these tests keep a live broadcast up for part of their
    run and the banner is shared across all of them. Each test may only assert about **its own**
    message; the file now says so.
  - _And a flaky assertion of my own making, fixed properly rather than retried._ The ping test
    asserted on one snapshot of a job a real worker had not finished yet; the first fix polled but
    read the page **during** navigation and so kept seeing nothing, which looked like the same
    failure and was not. The loop now waits for the table before reading it -- the distinction
    between "not finished" and "not loaded" is the whole of what went wrong.
  - _Observations:_ **253 e2e tests pass** (249 before), 170 unit tests.

- **[2026-09-02 19:40] F-028 + A-001 + A-007:** The last three before the parity sweep.
  - **_F-028: both pins stay, and one of the two reasons has changed._** `typescript@7.0.2` and
    `eslint@10.9.1` are released, so the ticket's premise ("the blocking condition may be gone")
    was worth checking -- but `typescript-eslint@8.69.0`, latest and canary alike, still declares
    `typescript: >=4.8.4 <6.1.0`. TS 7 is excluded outright and that half is untouched. **The
    ESLint blocker has moved**, though: `typescript-eslint` now accepts `^10.0.0`, and the only
    thing still holding ESLint at 9 is `eslint-plugin-react@7.37.5` -- **transitive**, via
    `eslint-config-next`, peering at `^9.7`, and with a `next` dist-tag (`7.8.0-rc.0`) that is an
    _older_ release than latest. `AGENTS.md` now says to look at that plugin first next time.
  - **_A-001: the landing page reads no session, and that is a deliberate split._** The legacy
    `Home` is one screen branching on the reader's role; this app's IA already separates `/` from
    `/dashboard`, so the front door reads the same for everybody (DEC-116). `readSessionToken`
    carries an explicit note that it is **not** a general "is the reader signed in" helper, and a
    marketing page is the wrong place to introduce one. It costs nothing: `proxy.ts` already sends
    a visitor who has a session from `/login` to `/dashboard`, so the sign-in link needs no branch.
  - _Moving it into `(anon)` was a bug fix, not tidying._ At `app/[locale]/page.tsx` the root page
    had **no `<main>` landmark and no language switch** -- the same gap S-024 found on the other
    anonymous pages, still open on the one page a visitor sees first.
  - _The public instance read is now shared._ A-003's registration page had its own inline
    `fetchInstances()`; the landing page needs the same anonymous call, so it moved to
    `getPublicInstances()` and the copy went.
  - **_A-007: the page it names has nothing to port, and that is the finding._**
    `LoginExternFinalization` exists **only** to serve the legacy app's popup -- it reads the token
    out of its own URL, `postMessage`s it to `window.opener`, waits to be told it arrived, and
    closes itself. F-019 built this app's side as a plain redirect target, so there is no second
    window and no opener to talk to. Porting the page would be porting the _mechanism_ rather than
    the capability (DEC-117).
  - **_What was actually missing was the way in._** F-019 built the callback and its failure state;
    **nothing ever sent anybody to the provider**, so external sign-in was unreachable rather than
    unconfigured. That link is this ticket, reading the same three variables the legacy does and
    offered on the same condition -- both the URL and the service id set. The URL is used exactly
    as configured with nothing appended, because where the provider returns to is its own business.
  - _Unconfigured here, so verified from the other side by hand:_ the three variables were set in
    `.env.local`, the app rebuilt, and the button confirmed to render with exactly the configured
    URL; then removed and rebuilt again. The spec asserts the absent case, which is the one this
    deployment can actually be in (Q-004).
  - _Observations:_ **257 e2e tests pass** (253 before), 170 unit tests.

- **[2026-09-07 21:30] G-001:** A teacher can say what an attempt is worth.
  `lib/actions/solution-verdict.ts` and its schema, `components/solutions/verdict-controls.tsx`, the
  solution screen, `e2e/solution-verdict.spec.ts`.
  - _Two grants, two halves, rendered independently._ `setFlag` decides whether the accept control
    appears and `setBonusPoints` the points one; core-api hands them out separately, so the screen
    does too rather than gating both on whichever is handier.
  - **_Accepting confirms, because it is a move rather than an addition._** `actionSetFlag` treats
    `accepted` as **unique per author per assignment** -- read in core-api's source and then watched
    happen -- so it clears the flag from every other attempt that student made before setting it
    here. A button that quietly takes something off another screen has to say so, and the dialog
    does. Taking it back needs no confirmation: it removes nothing from anywhere else.
  - _Three shortcuts and a form, the legacy screen's own shape._ Award nothing, award full marks,
    clear the award -- one click each, because a teacher fixing a broken test does this on twenty
    submissions and should not type "0" twenty times. They are not separate endpoints; all four
    submit the same call.
  - **_`overriddenPoints` is a string, or null to clear, and core-api's source carries three TODOs
    apologising for it._** `Validators::isNumericInt` decides whether to set it, `empty()` decides
    whether to clear it, and anything else is a 400 -- verified by sending all three, including the
    400 for `"nope"`, against the live instance before a line of UI existed.
  - _Verified live first, then in the browser._ The four calls this action makes were exercised
    against a real seeded solution and the solution was put back exactly as the seed leaves it.
  - **_Two pieces of pre-existing test rot surfaced and were fixed, because the tree cannot be red._**
    Neither was caused by this ticket and both were caused by time rather than by code.
    (1) `groups.spec.ts` asserted that the "closed" assignment filter was **empty** -- true the week
    the seed was written, false now that two seeded deadlines have passed. It asserts the property
    that is actually about the filter now: it narrows, and its result survives a reload.
    (2) **The submit test was not idempotent.** It uploads a real file and creates a real solution
    every run and removed none of them, so Alice's attempt count grew by one per full suite run
    until `assignment-solutions.spec.ts`'s `toHaveCount(3)` stopped being true -- the suite
    reporting on its own history rather than on the app. It cleans up after itself now, and the two
    solutions earlier runs had left were removed.
  - _One thing that was **not** a defect._ Three consecutive full runs failed one different
    unrelated test each -- pipelines, forgot-password, assignment-solutions. That was contention: a
    `pnpm dev` server was running beside the suite's own production server and two workers. With it
    stopped, all 264 pass. Worth knowing before somebody hunts a flake that is not there.
  - _Observations:_ **264 e2e tests pass** (257 at the start of the day, +4 for G-008, +3 here),
    170 unit tests. Twenty-seven gaps remain.

- **[2026-09-07 22:40] G-002:** Work already submitted can be re-graded, and removed.
  `lib/actions/solution-rerun.ts`, `components/solutions/rerun-controls.tsx`,
  `components/assignments/resubmit-all.tsx`, `canResubmit` on the solution, `e2e/solution-rerun.spec.ts`.
  - _Until now nothing in this app could apply a fix to work already done._ A teacher who mended a
    broken test, a wrong limit or a bad judge had no way to re-grade against it: every solution on
    record kept the verdict the broken configuration gave it.
  - **_A resubmit answers with a submit's own payload, and that turned out to matter._** core-api
    builds both through `finishSubmission`, so a re-run comes back with the **monitor channel** of
    the job it just started -- disclosed once and never again. So the control **navigates** to the
    same `?monitor=&tasks=` URL the submit form produces rather than merely refreshing, and S-016's
    live progress display works for a re-run exactly as it does for a first submission. Refreshing
    would have looked identical and silently thrown the channel away.
  - _Debug is a second button rather than a checkbox._ It is not a variation on the ordinary re-run;
    it is what a teacher reaches for when the ordinary result did not explain itself, and a checkbox
    left ticked from last time is a surprise the next re-run does not need.
  - **_Re-running everything is asynchronous, and the screen says so rather than lying._** core-api
    starts a background job and answers with the pending and failed job lists -- and **starts
    nothing at all if a job is already pending, answering with the same list either way**. So
    "started" and "already running" are indistinguishable in the response; the toast reports how
    many jobs are pending instead of claiming the work is done, and the rows do not change under the
    reader's hands.
  - _The gate is the **assignment's** hint, not the solution's_ (`canResubmitSubmissions($solution->getAssignment())`),
    and the solution screen already fetches that assignment for its name -- so reading
    `resubmitSubmissions` off it costs nothing. Deleting is the solution's own `delete`.
  - _Deleting takes more than it looks like._ core-api removes the review and its comments, every
    submission's result archive and job config, and the submitted source, and it does not confirm.
    The dialog here is the only confirmation there is, so it names all of it.
  - _Verified live before any UI existed:_ a real resubmit returned a real channel id and
    `expectedTasksCount: 6`, and the extra evaluation run it created was deleted again through
    `DELETE /v1/assignment-solutions/submission/{id}`.
  - **_This ticket's own spec had the defect G-001 had just fixed elsewhere, and it was caught the
    same way._** The re-run test adds an evaluation run to a **seeded** solution, so without cleanup
    it would deepen that solution by one on every pass -- exactly the drift that had broken
    `assignment-solutions.spec.ts`. It now records the submissions before and removes whatever is
    new afterwards, and the instance was confirmed byte-for-byte back: four solutions, one
    submission on the one it re-ran.
  - _`resubmit-all` is offered by the spec and not pressed_, deliberately: it starts a job over
    every submission of an assignment and there is no way to wait for one without asserting on the
    worker's own timing. Verified by hand instead, the way T-002 verified its re-sync.
  - _One flake, and it was not this ticket._ A full run failed `system-messages.spec.ts`, which
    passed in isolation immediately afterwards; the broadcast it had left behind was removed. Two
    workers against one instance, with system messages rendering above every page, is the shape
    that produces it.
  - _Observations:_ **269 e2e tests pass** (264 before), 170 unit tests. Twenty-six gaps remain.

- **[2026-09-07 23:30] G-003:** The dashboard queue is no longer empty by construction.
  `setReviewRequested()` in `lib/actions/solution-review.ts`,
  `components/solutions/review-request.tsx`, the solution screen, `e2e/review-request.spec.ts`.
  - **_The cheapest ticket in the queue, and the one with the strangest shape:_** S-002 built the
    teacher's "reviews students have asked for" panel, `reviewRequested` is read in four places
    across this app, and **nothing anywhere could set it.** The badge rendered, the queue existed,
    and only the seed could ever put a row in it.
  - _Offered on `setFlagAsStudent` **or** `setFlag`_, which is core-api's own weaker test for this
    flag -- `checkSetFlag` maps `reviewRequest` to "the author may also do this" and `accepted` to
    "the teacher only". Watched happen rather than read: as the author, toggling this flag succeeded
    and `accepted` was refused with a 403 in the same breath, which also confirms G-001's gate.
  - **_Gone once a review exists._** Asking for something already happening is noise, and
    withdrawing would not stop a teacher who has started reading -- core-api keeps the flag and the
    review independently, so the honest thing is to stop offering it rather than imply it still
    means something.
  - _Unique per author per assignment, like `accepted`_ -- but this one needs no confirmation,
    because it moves the student's **own** request rather than taking something off somebody else's
    screen.
  - **_The spec's second test is the ticket._** Asserting the panel exists proves nothing: the seed
    leaves two requests standing, so the heading is there either way. It asserts that a link to
    _this_ solution appears in that panel after the student asks.
  - **_Two false alarms on the way, both worth recording so the next reader does not repeat them._**
    First, the control seemed not to render for the student -- it was correct, and the fixture was
    wrong: the seed **opens a review on its first solution**, which is precisely the state the guard
    hides for. A `seededSolutionWithoutReview()` helper now finds one that is clean, and the guard
    got a test of its own. Second, `[seed] correct` appeared to have lost its seeded review request
    -- it had not; the seed puts that solution under **two different assignments** and the one being
    read was the other. Re-seeding was run before that was understood and changed nothing, which is
    itself the useful fact: `scripts/seed.ts` is idempotent and did not need to repair anything.
  - **_And one real defect in this ticket's own spec._** All three tests act on the same seeded
    solution -- there is only one without a review -- so run in parallel the first test's teardown
    cleared the flag the second had just set, and the second then failed looking for a row core-api
    had already been told to remove. Confirmed by asking `/v1/users/{id}/review-requests` directly
    with the flag set, which returned it. The file is `mode: "serial"` now, with the reason written
    where the next person will read it.
  - _Observations:_ **272 e2e tests pass** (269 before), 170 unit tests. Twenty-five gaps remain.

- **[2026-09-08 00:40] G-009:** `scripts/seed.ts` is no longer a shadow assignment's only way in.
  `lib/actions/shadow-assignment.ts` and its schema, `getShadowAssignmentSettings()`,
  `components/assignments/shadow-assignment-form.tsx`, `/shadow-assignments/[shadowId]/edit`,
  `CreateShadowAssignment` on the group's Assignments tab, `e2e/shadow-assignment-edit.spec.ts`.
  - _S-020 built reading one and T-024 the points awarded against it_, and the entity's own
    lifecycle was never built -- so the seed had to create them by raw API call, because no screen
    could. That is what this closes.
  - **_Creating takes a group and nothing else, so there is no dialog._** core-api's `actionCreate`
    accepts only `groupId` and hands back an empty assignment -- DEC-093's create-first shape for
    the third time, and the one place it is not even a choice: a form here would collect fields the
    endpoint cannot receive. One press, and the settings screen it lands on is where the name, the
    points and the deadline are typed.
  - _A second reader, for the reason `getAssignmentSettings` exists._ The detail screen wants the
    text in the reader's language; the editor wants **all** of them, including the languages the
    assignment has no text in yet -- which are exactly the ones somebody opens the editor to fill.
    **A locale omitted is a locale deleted**, because core-api replaces the whole collection with
    what it is sent, so the form carries a row per locale this app speaks _plus_ any the assignment
    already has in another.
  - _`version` rides along as the optimistic lock_, its `400-010` surfaced verbatim rather than
    retried -- verified by sending a stale version and getting core-api's own sentence back.
  - **_The deadline is informative and the form says so in words._** Nothing is submitted against it
    and nothing is enforced by it; core-api's own documentation says the supervisor decides whether
    it was breached. That is DEC-087's reasoning from the authoring side, and a picker that looked
    like a real deadline would promise a countdown that does not exist.
  - _The whole lifecycle was verified against the live API before any UI existed:_ create returns
    version 1 with no texts, the update this action sends moves it to version 2, a stale version is
    refused, a malformed link is refused, and the delete answers 200.
  - _Two mistakes in the spec, both mine and both worth noting._ The save toast matched **twice** --
    P-002 gave every toast an `sr-only` live-region twin, and `sr-only` is clipped rather than
    hidden, so a bare `getByText` is ambiguous now; `{ exact: true }` picks the visible one. And the
    link test asserted a form error that never renders: the field is `type="url"`, so the **browser**
    refuses the value before the form's own rule is reached. The assertion is about the field's
    validity now, and the schema's rule is still what matters, since a Server Action is a public
    endpoint whatever the browser did.
  - _The instance is left with the two shadow assignments the seed makes and no strays._
  - _Observations:_ **276 e2e tests pass** (272 before), 170 unit tests. Twenty-four gaps remain.

- **[2026-09-08 01:40] G-005:** The landmine that was stepped on, defused. `lib/code/diff.ts` and
  its 12 unit tests, `components/solutions/diff-view.tsx`,
  `/solutions/[solutionId]/diff/[otherId]`, `ComparePicker` on the sources screen,
  `e2e/solution-diff.spec.ts`.
  - _Brief §7 named solution diffing as a thing that must survive the redesign,_ `INVENTORY.md`
    carried it in **three** rows with "keep capability" beside it, and nothing was ever built. P-001
    found it; this closes it.
  - **_The diff is written here rather than pulled in, and that is not invented-here._** The legacy
    app ships `react-diff-viewer`, which is a React component carrying its own markup, its own
    styling and its own highlighter -- and this app tokenises code on the **server** through Shiki
    and renders it through one shared `CodeLine`. Adopting that library would have meant a second
    highlighter in the browser on the screen a teacher reads most. What was actually needed is the
    _pairing decision_: an LCS line diff, forty lines, unit-tested, shipping nothing to the client.
  - _Twelve unit tests, and one of them found a real bug before any screen existed:_ `"".split("\n")`
    is `[""]`, so an empty file diffed as one blank line and the screen would have reported
    "removed a blank line" for a file that was never there.
  - **_Files pair by name, and everything unpaired is named rather than compared to what was left
    over._** Two attempts at one exercise almost always carry the same filenames; when they do not,
    quietly diffing `main.py` against `solution.py` because they happen to be the only two left is
    worse than saying they did not match. Legacy lets a reader map those by hand -- filed as
    **G-030**, with the note that nothing is hidden without it.
  - _Colour is never the only signal._ Each changed row carries `+`/`−` and an `sr-only` word in its
    own column; the tint is for the sighted reader. P-002's lesson from the points matrix, applied
    before anybody had to file it, and the table keeps `scope`, a caption and one header row.
  - _Reviews are deliberately absent_, as they are in the legacy diff: a comment is anchored to one
    solution's lines, and in an aligned two-file view its anchor may land on a row belonging to the
    other file. A comment shown against the wrong line is worse than one not shown.
  - **_A gate got this wrong first, and the suite caught it in the right way._** The picker was
    gated on the solution's own `viewDetail` -- which **its author has** -- so a student's sources
    screen rendered a picker whose reader then hit a teacher-only endpoint, and `apiRead`'s refusal
    took the whole page down: four `solution-sources` tests lost their "Source code" heading. The
    hint that means "may read other people's attempts" is the **assignment's**
    `viewAssignmentSolutions`, which the solution screen already fetches, so the fix cost no round
    trip. Both screens are gated on it now, and the diff checks it on **both** solutions, since the
    two may belong to different assignments.
  - _Verified in the browser against the seed's own attempts:_ `[seed] correct` against
    `[seed] wrong` lines up as one removal and one addition, syntax-highlighted, with the swap link
    reversing the sides.
  - _Observations:_ **281 e2e tests pass** (276 before), **182 unit tests** (170 before). Twenty-three
    gaps remain, plus G-030 filed by this one.

- **[2026-09-09 08:20] G-024:** The last placeholder in the product, and the one a stranger meets
  first. `lib/faq/faq-url.ts` and its seven tests, `lib/faq/document.ts`,
  `app/[locale]/(anon)/faq/page.tsx`, `e2e/faq.spec.ts`.
  - **_The front page has been sending visitors to "this page hasn't been built yet."_** That is
    the whole reason P-001 ranked this above every remaining teacher control (RETROSPECTIVE §6.5):
    the gaps under it cost a signed-in professional a workaround, this one is the product's first
    impression, and `/`'s second call to action walked straight into it.
  - _The document is not this app's, and that is the design._ `FAQ_URI` is the legacy frontend's
    own variable with the legacy frontend's own semantics -- one URL, or a per-locale mapping
    falling back to English and then to whatever is there, defaulting to the ReCodEx wiki so the
    page says something useful on a deployment nobody configured. Legacy reads it out of a JSON
    config file, so the mapping form is an object there; an environment variable is a string, so it
    is parsed as JSON here. **Both forms verified live**, the mapping against two locally served
    documents: `/en/faq` and `/cs/faq` rendered different files, each as markdown.
  - **_Fetched on the server, which is not where legacy fetches it_**, so the value decides what
    this app's own machine connects to: only an absolute `http(s)` URL is accepted, and anything
    else -- `file:///etc/passwd`, a relative path, unparseable JSON -- resolves to the same
    "could not be loaded" a misconfiguration always did. The `response.ok` check is likewise not
    legacy's, which reads the body whatever the status and would render a 404 page as the FAQ.
  - **_DEC-120, and the half of it that had to be found rather than reasoned about._** The fetch is
    the one cached read in this app (`revalidate: 3600`) -- not core-api's, not per-user, so
    DEC-021 is about something else, and without it every page view is a request to a third party.
    Four page loads against a local fixture server produced **one** upstream GET. But the page
    around it had to be kept _out_ of the build: `next build` reports `/en/faq` and `/cs/faq` as
    `●` prerendered, and a prerendered page reads `process.env.FAQ_URI` on the **build** host,
    which supplies nothing -- this deployment builds an image once and hands it an environment
    through compose. `connection()` before the fetch makes it `ƒ`, confirmed by building both ways
    and reading the route table, and the Data Cache still applies afterwards. `dynamic =
"force-dynamic"` would have rewritten the fetch to `no-store` and lost the cache
    (`caching-without-cache-components.md`, read in `node_modules`).
  - _Legacy ships a stylesheet for this one page_ (`src/pages/FAQ/FAQ.css`: underlined headings, a
    quote glyph). Deliberately not ported -- D-010's markdown styles already differentiate the same
    elements, and a second set scoped to one page is how two markdown surfaces drift apart.
  - **_`components/placeholder-page.tsx` is deleted, not orphaned._** This route was its last
    caller; the two remaining mentions of it in the tree are doc comments recording where a
    placeholder used to be. `resolveBreadcrumbsForNamespace`'s comment, which cited it as the
    convenience entry point's user, now names the pages that actually call it.
  - _Verified live in both locales_, and from the other side by hand: with `FAQ_URI` pointed at a
    dead port the page renders legacy's exact sentence in English and in Czech and emits no
    markdown container at all. The spec asserts the working half in both locales and the landing
    page's button reaching it, because the failing half is decided by an environment the e2e server
    cannot vary per test.
  - _Filed **G-031** on the way:_ the legacy sidebar offers the FAQ to a signed-in reader
    (`Sidebar.js:205`) and this app's does not, because `IA.md` §2 files `/faq` with the anonymous
    pages. Reachable through `/` -- which a signed-in reader may still open -- and by URL, so it is
    a navigation gap rather than a lost capability, and the acceptable outcome is either one
    sidebar item or one `IA.md` line saying it stays anonymous-only.
  - _Observations:_ **284 e2e tests pass** (281 before), **189 unit tests** (182 before). Twenty-two gaps remain,
    plus G-031 filed by this one.

- **[2026-09-09 08:45] G-029:** A reference solution's failure stops being a dead end.
  `components/failures/failure-table.tsx`, `lib/api/submission-failures.ts`,
  `e2e/submission-failures.spec.ts`.
  - _The cell was inert because the screen it wanted did not exist when T-019 was built_, and by the
    time T-011 built it nothing went back to connect the two -- RETROSPECTIVE §6.6's point that the
    cheapest work left is finishing halves of things that already exist.
  - **_It needs two ids, not one._** T-011's route is `/exercises/:exerciseId/reference-solutions/:id`,
    and core-api reports `referenceSolutionId` and `exerciseId` independently: a failure whose
    exercise has since been deleted keeps the first and loses the second. Both, or the plain text it
    was -- DEC-066's rule, because Next prefetches every visible link and a route that cannot be
    built would 404 from here on every render.
  - _Every reference-solution failure on this instance is **resolved**_, so the row is in the
    history rather than the queue (DEC-096), and the only thing that tells those rows apart from the
    student submissions filling the same list is core-api's own wording: the description names the
    job's kind (`type: 'reference'`). That is what the spec filters on.
  - _Two stale sentences went with it_ -- `lib/api/submission-failures.ts` said "no screen of this
    app shows one yet" and the T-019 backlog row said the same. Both were true when written and had
    been false since T-011.
  - _Observations:_ 4 e2e tests in that file pass (3 before). The failure list on this box is 88
    rows, 8 of them reference solutions, all from the seeded exercises' own evaluations.

- **[2026-09-09 13:30] G-004 (the `exitCode` half):** A student whose program crashed is told what
  happened to it. `lib/status/exit-code.ts` and its 3 tests, `components/solutions/evaluation-results.tsx`,
  `lib/api/solution.ts`, the design-system showcase's first evaluation fixture.
  - **_Three fields core-api sends and this app was throwing away._** `exitCode` was already on the
    interface and rendered nowhere; `exitCodeOk`, `exitCodeNative` and `exitSignal` were not even
    declared. Read off core-api's own entity (`repos/api/app/model/entity/TestResult.php`) rather
    than the swagger, which has no response schemas at all.
  - _They are three different questions and the cell answers them in that order._ `exitSignal` is
    the process being **killed** rather than returning. `exitCodeNative` says the code is the
    program's own -- false means a signal, a timeout or the sandbox produced it, and then there is
    nothing to name. `exitCodeOk` is the **exercise's** verdict, which need not be zero, so a code
    the exercise accepts is shown as the number and one it does not is given its name.
  - **_The names are the legacy app's own tables_** (`exitCodeMapping.js`): 99 codes over
    `freepascal-linux`, `python3`, `java` and `cs-dotnet-core`, produced not by the operating system
    but by the wrapper each environment runs a solution under -- `110` from Python is a division by
    zero. Only the **codes** live in `lib/status/`; the names are messages like every other string,
    and an unknown code renders as the number it is, which is what legacy does too.
  - **_All 99 are English in the Czech locale, and that is the legacy app's state carried across on
    purpose._** Checked rather than assumed: of the 100 `app.exitCodes.*` keys in `cs.json`, exactly
    one (`unknown`) differs from English. These are the runtime's own error names -- a Czech student
    debugging Java searches for "NullPointerException", not a translation of it -- so the keys exist
    in both locales, as constraint 6 requires, and hold the same text.
  - _The keys are built at render time_, so `messages.test.ts`'s literal-key scan cannot see them.
    `lib/status/exit-code.test.ts` is the same guard for the one place in the app where a key is
    data: every code the table claims to know has a string in both locales.
  - **_Verified live, which needed a fixture, because this box cannot produce a test result at
    all._** DEC-031's sandbox never runs, so no solution here has ever carried one -- the standing
    "unverified for want of an environment" list. D-013's showcase now renders an `EvaluationResults`
    with six rows covering every branch, and all six were read back out of the DOM in both locales:
    a named code (`Zero division error`), an unnamed one (`42`), a signal (`Terminated by signal
11`), a skipped test (empty), and a non-zero code the exercise accepts (`3` plus the note that
    explains it). That fixture is committed rather than thrown away: RETROSPECTIVE §6.19's
    complaint is precisely that these states have never been seen, and now one of them can be.
  - _`EvaluationResults` takes `environment` as its own prop_ rather than widening
    `EvaluatedSubmission`, whose whole point (T-011) is that a reference solution shares the
    evaluation and none of the rest. Both call sites already had the id under different names.
  - _Observations:_ **192 unit tests** (189 before), and `design-system.spec.ts` grew a test for
    the six cases (8 in that file, 7 before) -- the only automated coverage this rendering can have
    here. The rest of G-004 -- the runs behind a solution, the `?submission=` selector, the result
    archive -- is still open and is a screen.

- **[2026-09-09 14:10] G-027:** A review reads like a code review, not like a terminal dump.
  `components/solutions/review-comment.tsx`, `review-summary.tsx`, `reviewable-code.tsx`,
  `source-file.tsx`, `app/[locale]/(app)/solutions/[solutionId]/sources/page.tsx`,
  `e2e/solution-sources.spec.ts`.
  - **_It is not the one-line change the ticket and RETROSPECTIVE §6.6 both promised_**, and the
    reason is worth more than the fix. `<Markdown source={...} />` in place of the `<p>` does not
    compile: `Markdown` is `async` -- it awaits D-009's highlighter -- and only a Server Component
    may be async. Every component on the review path is a **client island**, because a comment
    thread has to appear _between two lines of code_, which is the one thing server-rendered HTML
    cannot be given to a child of (`reviewable-code.tsx` says so in as many words).
  - _So the markdown moved rather than the tag._ The page renders one `<Markdown>` per comment and
    passes them down by id through `ReviewSummary`, `SourceFile` and `ReviewableCode`; the item
    takes a `body` slot and falls back to the plain text it rendered before. **DEC-121**, and it is
    the rule for the next one too -- G-028's markdown preview has the same shape.
  - **_The refresh discipline was already there, which is what makes it correct rather than merely
    working._** Every write in `review-comment.tsx` calls `router.refresh()`, so the server
    re-renders and the new body comes with it. Verified live rather than reasoned about: a comment
    was edited in the browser and `## After the edit` became an `<h2>`, with a GFM table beside it,
    without a reload.
  - _The alternative was rendering markdown in the browser_, and it was refused: react-markdown,
    remark, KaTeX and Shiki in the bundle, on the screen a teacher reads most, while PF-001 is open
    about exactly that kind of weight.
  - _Verified live before the spec existed:_ a comment carrying emphasis, inline code, a list, a
    link and a fenced python block rendered as `<strong>`, `<code>`, `<li>`, a real `<a href>` and
    one Shiki block -- and `**enumerate**` appeared nowhere as text. Written through the API,
    read in the browser, deleted afterwards.
  - **_Two failed runs of my own spec left the instance dirty, both times._** The review test starts
    a review and erases it at the end; a failure in between leaves the review open, and the next run
    then times out looking for a "Start review" button that has become "Close review". Erased by
    hand through core-api both times. The suite has this shape elsewhere too -- it is the same thing
    that made `solutions.spec.ts` fail earlier today after the worker was down for one run.
  - _Observations:_ 4 e2e tests in that file pass, the review one now covering both halves of the
    review surface -- the line comment and the solution-level one, which is the path that carries
    the markdown assertions.

- **[2026-09-09 14:35] G-013:** An exercise's author can read the solution that proves it works.
  `getReferenceSolutionFiles()` in `lib/api/solution-files.ts`,
  `app/api/reference-solutions/[solutionId]/download/route.ts`, the detail screen,
  `components/solutions/source-file.tsx`, `e2e/reference-solutions.spec.ts`.
  - **_The doc comment was the bug report._** T-011's own page said "the files are named and
    downloadable through the same route S-017 built for a student's" over a list of
    non-interactive `<span>`s -- a name, a size, and no way to reach either. RETROSPECTIVE §6.6
    files it under the thing this project keeps doing: a screen that reads well and cannot be acted
    on, described as though it could.
  - _Nothing new had to be invented, which is the point of the rank._ core-api builds both file
    listings with the **same** `SolutionFilesViewFactory` (read from
    `ReferenceExerciseSolutionsPresenter::actionFiles`, not assumed), so the ZIP expansion S-017
    wrote applies unchanged and became a shared `expand()`. The archive route is the student one
    with a different path.
  - **_No permission hint to check, and that is core-api's answer rather than an omission._** Both
    `checkFiles` and `checkDownloadSolutionArchive` test `canViewDetail` -- the grant that discloses
    the solution at all. A reader who has this screen has its files; one who does not never reaches
    it. Verified from both sides: the superadmin (whose solutions these are -- they are private)
    gets the archive, `application/zip`, `PK` bytes and all; a supervisor is refused **403** by
    core-api and the route forwards it; no session is **401** before core-api is asked.
  - **_The files are read where they are listed, not behind a second screen._** A student's
    solution has a `/sources` route because it carries a **review**; a reference solution has none,
    so a route would be a click for nothing. S-017's `canDisplayFiles` ceiling comes along with the
    viewer -- past 32 files or a megabyte the list and the archive are what is offered, which is
    the same bargain the student's page makes.
  - _`SourceFile`'s six review props became one optional `review` object._ The new call site has no
    review and never will, and six dummy props at it would have been a lie about what the component
    needs. `interactive` now reads as what it means: a review exists and somebody may act on it.
  - _Per-file download is deliberately not carried across._ Legacy offers one; this app's own
    student viewer does not, and the file is on screen with the archive one click away. Recorded
    here rather than in `DROPPED.md` because the capability is not lost, only merged.
  - _Verified live_ against the seeded reference solution: `solution.py` renders as highlighted
    source, the archive downloads as a real ZIP, and the student's own sources page still works
    after the props refactor.
  - _Observations:_ **286 e2e tests passed** on the full run after rank 6 (284 before it), and the
    two specs touched here pass. One inventory row (`referenceSolutionEvaluations`) stays partial
    until G-014.

- **[2026-09-09 14:50] G-013 follow-up:** The file listing was fetched twice, and it was mine.
  `lib/api/reference-solutions.ts`, the detail screen.
  - _G-013 added `getReferenceSolutionFiles()` and had the page call it, without noticing that
    `getReferenceSolution()` was **already** reading the same endpoint_ for the name-and-size list
    it used to render. Two round trips to `/v1/reference-solutions/{id}/files` per page view, one
    of them for a shape nothing rendered any more.
  - _The fix is the one reader, used by both._ `ReferenceSolutionDetail.files` is now
    `SolutionFileEntry[]` from the shared expansion, so the archive-aware listing is what the whole
    app sees and `ReferenceSolutionFile` is gone. Caught by reading the module while starting
    G-014, not by any check we have -- `cache()` dedupes within a render only when it is the _same_
    function, which is exactly what these two were not.

- **[2026-09-09 15:05] G-014:** The runs behind a reference solution, and what can be done to one.
  `app/[locale]/(app)/exercises/[exerciseId]/reference-solutions/[solutionId]/page.tsx`,
  `components/exercises/reference-run-controls.tsx`, `deleteReferenceSubmission()`,
  `app/api/reference-solutions/submissions/[submissionId]/result/route.ts`,
  `e2e/reference-solutions.spec.ts`.
  - _The selector cost no round trip._ `getReferenceSolution()` already fetches **every** submission
    with its full evaluation -- T-011 built the history list out of it and then rendered a date and
    a badge. `?submission=` picks from what is already on the page, so a particular run is a URL, it
    survives a reload, and a link to it can be sent to somebody.
  - **_An id that is not this solution's is `notFound()`, not a silent fall back to the last run._**
    DEC-090's shape again: showing one run under another's URL is worse than saying the address is
    wrong. Verified live with a zero uuid.
  - **_core-api refuses to delete the last run_** -- `checkDeleteSubmission` throws a
    `BadRequestException` when fewer than two exist, which is **not** a permission problem and which
    no payload announces. So the control is gated on `deleteEvaluation` **and** a second run, and
    the history section (and with it every delete button) disappears again the moment one is left.
    Read off the presenter, then watched happen: deleting the run this session made took the whole
    section with it.
  - **_A reference resubmit answers with one channel per hardware group_**, not the single
    `webSocketChannel` a student's does (`finishSubmission` loops over `getHardwareGroups`). S-016's
    live-progress island watches one; following one of several would be arbitrary, so this screen
    refreshes and the new run appears in its history. Recorded rather than worked around -- on a
    deployment with several hardware groups it is a real design question.
  - _The result archive is gated on `viewDetail`, not on `downloadResultArchive`_, because a
    reference solution has no such hint; the legacy app makes exactly this distinction at
    `SolutionDetail.js:237` by reading a different hint for the two kinds of solution.
  - _Debug was already accepted and never offered._ `resubmitReferenceSolution(id, debug)` has taken
    the flag since T-011 and every caller passed `false`. It is a second button rather than a
    checkbox, G-002's reason: a checkbox left ticked from last time is a surprise.
  - _Verified live end to end_, and the instance is left as it was found: a debug run was made, the
    history appeared, the older run was selected by URL and said it was not the current one, the run
    was deleted and the section vanished. The spec does the same and cleans up after itself --
    checked afterwards that the solution is back to its single seeded submission.
  - _Observations:_ 4 e2e tests in that file (3 before). **G-004's remaining half is now the same
    screen on the student's side**, and this is the shape to copy.

- **[2026-09-09 19:30] G-004 (the rest of it):** The runs behind a solution, and a defect in every
  download route in the app. `getSolutionSubmissions()` and `getSubmissionScoreConfig()`,
  `app/[locale]/(app)/solutions/[solutionId]/page.tsx`, `components/solutions/delete-submission.tsx`,
  `components/solutions/score-config.tsx`, **`lib/http/stream-download.ts`**,
  `e2e/solution-rerun.spec.ts`.
  - _Built as G-014's twin, deliberately_, because RETROSPECTIVE §6.8 asks for it: the same
    `?submission=` selector, the same "not the one that counts" warning, the same delete gated on
    core-api's own refusal to remove the last run. What differs is what core-api says -- the result
    archive is a real `downloadResultArchive` hint here and plain `viewDetail` there, which the
    legacy app also distinguishes.
  - **_core-api answers an unevaluated run's result archive with HTTP 202 and a JSON envelope_**
    (`{"success": false, "error": {"message": "Submission is not evaluated yet"}}`), because
    `NotReadyException` is a 2xx in this API. **`response.ok` is true for 202**, so every download
    route in this app -- S-017's solution archive, both of G-013/G-014's, and this one -- would
    hand the browser a file named `.zip` containing that sentence. Found by curling the route rather
    than by reading it. All four now go through one `streamFromCoreApi()` whose test is **200 and
    not JSON**; anything else is forwarded with core-api's own message, and a 2xx that is not a file
    becomes a 409. Verified both ways live: the unevaluated run answers `409` with "Submission is
    not evaluated yet", and a real solution archive still streams `200 application/zip`.
  - _The runs list is gated on `viewResubmissions`_ -- the legacy app's own gate for the same table
    -- while core-api gates the _list endpoint_ on `viewDetail`. Two different questions: who may
    read the runs, and who is offered the choice. Nothing is fetched for a reader not offered it.
  - **_The score-config explanation has never been rendered with data and cannot be here._**
    core-api reads it off the evaluation, and no evaluation on this host has ever produced one
    (DEC-031) -- `/score-config` answers `null` for every submission that exists. What is built
    reuses T-025's own reading: the calculator by name, `weighted`'s per-test weights as a table,
    `universal`'s tree through `printScoreExpression`, and a calculator this app has not been taught
    printed as its own id. Re-verify on a cgroup v1 host, with the rest of the standing list.
  - **_A grep for the rendered warning lied, and the message catalogue is why._** Checking the page
    with `"This is not the run..." in html` said **true** on a URL where the warning must not
    render -- because PF-001's whole catalogue ships inside every page. Re-checked by matching
    `>`-prefixed markup, which said false, as it should. Worth remembering the next time this
    project verifies a string by grepping HTML.
  - _Verified live in a real build:_ two runs listed newest-first with "Scored by this" and the
    debug badge on the newest, per-run result archives and delete controls, `?submission=` selecting
    the older one with the warning and its own archive link, and a fabricated id answering the
    not-found page. The spec asserts all of it and cleans up the run it makes.
  - **_Two pieces of residue were cleaned out of the instance_**, both mine: a debug run left on the
    seeded solution by this session's own verification, and an extra run on `[seed] wrong` left by
    the full suite that ran while the worker was down. The second had already broken the new spec's
    first assertion once -- the same class of failure as this morning's `solutions.spec.ts`.
  - _Observations:_ **288 e2e tests pass** (287 before), 192 unit tests. **G-004 closes the last
    partial row in the G block**, and with it ranks 1--8 of the retrospective's queue.

- **[2026-09-09 22:45] PF-001:** About 130 kB comes off every document. `scripts/route-messages.ts`,
  `lib/i18n-text/route-messages.ts` and its generated map, `proxy.ts`,
  `app/[locale]/layout.tsx`, `lib/i18n-text/route-messages.test.ts`.
  - **_Three designs, measured rather than argued (DEC-122)._** Pruning the catalogue globally to
    every namespace any client component uses leaves **71%** of it -- 46 of 63 top-level namespaces
    are reached by _some_ client component, so a global prune barely helps. Splitting by route group
    leaves `(app)` at **65%**, and `(app)` is most of the product. Per route leaves **2%** at the
    median (2,968 bytes of 126,514) and 12% at the worst, `/groups/[groupId]`. The first two were
    written off on numbers, not on taste.
  - _Measured before and after on the same build:_ `/en/login` **154,223 → 23,188** bytes (−85%),
    `/en` −80%, `/en/faq` −73%, `/en/dashboard` −57%, `/en/exercises` −53%. The absolute saving is
    about 130 kB on every document, which is what P-003 predicted.
  - **_The map is generated, and that is the whole safety story._** A namespace a route needs and
    does not get is a **runtime** `MISSING_MESSAGE` on one screen -- `typecheck` cannot see a string
    and `build` renders no page. So `scripts/route-messages.ts` walks each page's import graph,
    carrying an "inside a client module" flag across the boundary (a client component's own imports
    are client too), and unions in every layout above the page plus `error`/`not-found`/`forbidden`/
    `unauthorized`, which can render anywhere. The test re-runs it with `--check` and fails when the
    committed file is stale, so drift is red rather than silent.
  - **_A layout is not told which route it wraps_**, which is the one real obstacle. `proxy.ts` sets
    the locale-stripped path on the **request** headers _before_ next-intl runs -- read out of its
    compiled middleware, its pass-through does `new Headers(request.headers)` and forwards the lot,
    so this rides a mechanism that is already there instead of writing Next's
    `x-middleware-override-headers` by hand.
  - _The cost is one prerendered route._ Reading a header makes the layout dynamic, and
    `/forgot-password` was the only route still being prerendered -- 73 of 75 were already `ƒ`
    before this. A form that posts to core-api on submit is a thin thing to keep static, and the
    trade is recorded rather than absorbed.
  - **_A unit test found a real bug in my own picker before any page did._** Asked for
    `Solution.evaluation` and `Solution` together, the first version kept only the narrow branch and
    dropped `Solution.title` -- because it refused to overwrite an object it had already made.
    Fixed by taking the **widest namespace first** and skipping any whose parent is already taken,
    which also stops the picker from ever writing into the catalogue's own objects.
  - _An unmatched path falls back to the whole catalogue_ rather than to nothing: a route added
    without regenerating the map is as heavy as it was before this ticket, never missing its words.
  - **_The first design was wrong in a way only the suite could show, and it cost 43 red tests._**
    The provider went into `app/[locale]/layout.tsx`, which is right on a fresh load and wrong on
    every client-side navigation after it: the App Router does not re-render a layout two routes
    share, so the provider kept the messages of whichever route the reader landed on first. Every
    test that **clicks** rather than `goto`s went red on forms whose labels had vanished. It now
    lives in `components/route-messages.tsx`, rendered inside `PageShell` (40 of 48 pages) and in
    the six anonymous pages that have no shell; the layout keeps only what renders _outside_ a
    page, which the generator emits separately as `SHELL_MESSAGE_NAMESPACES`.
  - **_Three wrong diagnoses before the right one, and the sequence is the lesson._** After the
    redesign one test kept failing. I said it was a PF-001 regression -- it was not, and stashing
    the work showed it failing on `HEAD` too. I said it was timing -- it was not. What it actually
    was: `openSourcesContaining` waits for the "Source code" heading, which `PageShell` renders at
    once, and then reads `innerText` while the files are still behind their own `<Suspense>`,
    whose fallback is a skeleton with **no text at all**. It reported "no match" for a solution
    that plainly contained the marker. The helper now waits for the skeleton to detach.
  - **_And an over-eager cleanup of my own made it worse._** `assignments.spec.ts` submits a
    solution every run and deletes none, so one seeded assignment had grown to **70 solutions, 66
    of them residue** -- which is why the race began to bite. Deleting all 66 emptied the
    submission-failure queue, and `submission-failures.spec.ts` says in its own doc comment that
    resolving one permanently is affordable _because_ every run mints a new one. Three tests that
    had been green went red. Restored by re-seeding and minting four fresh failures. The suite's
    dependence on accumulated instance state is real and undeclared; **PF-006** records it.
  - _The suite also got its time back:_ **288 e2e tests in 4.4 minutes**, against 13--15 for the
    same 288 before the helper fix and the fixture cleanup. The walk was reading a Suspense
    fallback and then trying every remaining solution.
  - _Observations:_ **203 unit tests** (192 before). Verified live that `/en/faq` and `/en/login`
    carry none of `ExerciseConfig`, `Dashboard`, `Groups`, `Solution` or `Review`, and that
    `/en/dashboard` carries the shell's `Nav` and `Toast` and still not `ExerciseConfig` -- checked
    against `>`-prefixed markup, because the catalogue's own text is in the document and a plain
    substring search says "true" for a string that is nowhere rendered.

- **[2026-09-10 01:40] G-010:** A course's own exercises are where assigning starts.
  `getAssignableExercises()`, `app/[locale]/(app)/groups/[groupId]/assign/page.tsx`,
  `e2e/assign-exercise.spec.ts`.
  - _The write half has existed since T-008 and the read half never did._ Attaching and detaching an
    exercise to a group are both actions in `lib/actions/exercise.ts`; asking "what does this course
    hold?" was not a question this app could put to core-api, so T-001's picker started from the
    whole instance catalog every time.
  - **_`filters[groupsIds][]` is the group's ancestral closure, not its own attachments._** core-api
    expands the id through `groupsIdsAncestralClosure` before matching
    (`Exercises::getPreparedForPaginationGroupsFilter`), so a lab inherits its course's pool and a
    course its faculty's. Read from the repository rather than guessed, then confirmed against the
    seed: `Intro to Programming / Lab A` owns nothing and answers with its parent's 28. Reimplemented
    as a plain membership test this would have been quietly wrong for every subgroup.
  - _The scope is a URL, not a toggle._ `?scope=all` widens, the search carries whichever scope is
    on, and the current one is marked with `aria-current` -- brief §10's deep-linkable state, and the
    reason a narrowed picker can be sent to somebody.
  - **_A course whose own pool is empty is a state, not an error._** The seed attaches every exercise
    to one course, so `Large Lecture` has nothing of its own -- and the empty text has to say _that_
    rather than "there are no exercises", with the way out beside it. Both halves are asserted.
  - **_Two of my own measurement mistakes, both the same shape._** Checking the rendered page by
    grepping its HTML said "true" for text that is nowhere on screen -- the message catalogue is
    _in_ the document (PF-001 trims it per route but this route legitimately carries these strings),
    and so is the RSC payload. The second attempt cut at the first `<script` and found nothing at
    all. The DOM is the only honest view of a rendered page here, which is what the e2e harness is
    for; I went back to it.
  - _And a bug in my own spec that looked like a bug in the page:_ it built the assign URL from
    `page.url()` before the group's page had been reached, producing `/groups/assign` -- core-api
    answers a group id of "assign" with a 400, which the screen showed as "Something went wrong".
    The helper now waits for the group's own URL, and takes the group as a parameter so the
    empty-pool case walks the same path as the rest.
  - _Observations:_ 4 e2e tests in that file (2 before).

- **[2026-09-10 02:30] PF-006:** Two tests stopped consuming a queue they were not replacing.
  `e2e/helpers/core-api.ts` (`mintSubmissionFailure()`), `e2e/submission-failures.spec.ts`.
  - **_The mechanism was not what I assumed when filing it._** I wrote that `assignments.spec.ts`
    leaks a solution every run. It does not -- it deletes the one it submits, and has since
    somebody fixed exactly that. **That fix is what broke this**: deleting a solution takes its
    failures with it, so the instance stopped minting the fresh failure
    `submission-failures.spec.ts` was quietly consuming one of per run. The queue drained to zero
    and two tests in that file began reading an ordinary state of this instance as a broken screen.
  - _A test that consumes shared state has to replace it._ `mintSubmissionFailure()` re-runs a
    seeded solution and waits for the failure DEC-031's sandbox guarantees; the caller deletes the
    submission in a `finally`, which takes the failure with it. The instance is left exactly as it
    was found -- checked: the solution is back to its single seeded run.
  - _The resolve test also stopped being positional._ It used to sort by date and take the oldest
    row, which is a test of whatever ran last; it now finds **its own** row by the job id core-api
    puts in the description, which is the submission's own id.
  - **_Two things the drained queue taught, both of which cost a red run to see._** Resolving the
    last open failure empties the queue, and an empty queue renders the empty _state_ rather than
    the table -- so there is no filter box left to type into, and the assertion had to become the
    row's absence instead. And an assertion that waits for a string already on screen does not
    retry, where waiting for a count does.
  - _Verified from a deliberately drained queue_ -- every unresolved failure resolved by hand
    first, which is the state that reddened three tests earlier today. All four pass from it.
  - _Observations:_ this is the second time today a "clean up the residue" instinct was wrong. The
    66 solutions I removed this afternoon were load-bearing for this very spec. Residue and fixture
    look alike from the outside; the difference is whether some test depends on it, and that is
    written down nowhere.

- **[2026-09-10 03:10] G-018:** "Show me mine" is a question the catalog can now answer.
  `getExerciseAuthors()`, `filters[authorsIds][]` in `getExerciseCatalog()`,
  `app/[locale]/(app)/exercises/page.tsx`, `e2e/exercise-catalog.spec.ts`.
  - _The authors come from their own endpoint, not from the rows on screen._ `/v1/exercises/authors`
    exists for exactly this; deriving the options from the page would give a filter whose choices
    change as you page through it, since the catalog is paginated and 20 rows are not 28 exercises.
  - **_"Only mine" is a link, not a third state of the select._** It is a destination rather than a
    filter to combine, and it drops the page so the reader lands on the first of their own; the way
    back is the same control, relabelled. Offered only to somebody who has actually written an
    exercise -- to everybody else it is a link to an empty list, which is a worse answer than no
    link.
  - _Verified against a fixture that makes both halves assertable:_ the seed splits the catalog 4 /
    24 between two authors, so the filtered total has to be **smaller than everything and larger
    than zero** rather than merely different, and every author cell on screen is checked.
  - **_A defect fell out of getting the column index wrong._** Reading the second column instead of
    the fifth returned **`Exercises.difficulty.`** -- `exercise-table.tsx` and `exercise-picker.tsx`
    both do `t(\`difficulty.${exercise.difficulty}\`)`, and core-api serves `''`for an exercise
nobody set one on: 4 of this instance's 28. The catalog shows a reader the key path and the
server logs a`MISSING_MESSAGE` per row. Filed as **G-031b** rather than fixed here, since it is
    two call sites and its own sentence.
  - _Observations:_ **291 e2e tests pass** (289 before), 5 of them in that file (4 before).

- **[2026-09-10 04:00] G-006:** A class's work, offline, in one archive.
  `app/api/assignments/[assignmentId]/best-solutions/route.ts`, T-003's screen,
  `lib/http/stream-download.ts`, `e2e/assignment-solutions.spec.ts`.
  - **_The hint the button is offered on is not the one core-api checks, and that is deliberate._**
    `checkDownloadBestSolutionsArchive` tests the assignment's own `canViewDetail`, which a student
    holds for their own assignment; the archive's _contents_ are then filtered per student
    (`canViewSubmissions` plus each solution's `canViewDetail`). So a student calling it meets no
    403 -- they get an archive of their own work. A button labelled "everyone's best" must therefore
    be gated on `viewAssignmentSolutions`, the hint that means "may read other people's attempts",
    rather than on whatever would make the request succeed.
  - **_core-api answers `Content-Length: 0` on this host, every time._** "Best" is decided by
    points and no evaluation here produces any (DEC-031), so `findBestSolution` returns null for
    every student and the archive is never built. A nought-byte `.zip` is a file that cannot be
    opened, so `streamFromCoreApi` now reads an explicit zero length as "no file" and answers
    **409 "There is nothing to download."** -- a real empty ZIP is 22 bytes, and a streamed response
    carries no length at all, so neither is caught by this.
  - _What is verified here and what is not:_ the route streams, forwards core-api's refusals, and
    401s without a session -- all checked live, alongside a real solution archive that still comes
    back `200 application/zip`. The **populated** archive has never been seen and cannot be on this
    box; it joins the standing list.
  - _Observations:_ **292 e2e tests pass** (291 before). The spec asserts the link's address and
    accepts either answer from the route, since a cgroup v1 host would give the other one.

### Current Status

- **Phase:** Recon complete
- **Next ticket:** F-001 (Scaffold Next.js 16.3 repo)
- **Blocked tickets:** **F-028** (the TypeScript 7 / ESLint 10 pin), moved from `todo` on
  2026-09-02 because `todo` was never the right word for it: the re-evaluation it asks for has
  been done twice and the answer both times was "upstream is not ready". `typescript-eslint`
  still excludes TS 7 outright; `eslint-plugin-react`, transitive via `eslint-config-next`, still
  caps ESLint at 9. Nothing in this repo can lift either, so it waits on a release rather than on
  a session.
- **Operator inputs pending:** Q-001 (API URL), Q-005 (port), Q-007 (SMTP), Q-008 (multi-instance) — proceeding on assumptions per §3

---

## Template for Future Entries

```
- **[YYYY-MM-DD HH:mm] TICKET-ID:** Summary of what was done, what was verified, anything surprising.
  - *Observations:* Optional. Worth telling the operator later.
```

---

### Recon Complete

**Deliverables created:**

- docs/INVENTORY.md — 50+ routes, 40+ modules, key mechanisms, domain landmines
- docs/IA.md — Sitemap, navigation model, PageShell, key screen designs
- docs/BACKLOG.md — 120+ tickets in 7 phases
- docs/QUESTIONS.md — 16 questions with assumptions
- docs/DECISIONS.md — 25 decisions, 5 deferred, 20 dropped, 8 assumptions
- docs/PROGRESS.md — This file, append-only log
- docs/SEED_ACCOUNTS.md — Test account matrix
- docs/DROPPED.md — Dropped features with justification
- docs/ROUTES.md — Old→new route mapping

**Recon phase is complete. Proceeding to Foundation (F-001).**

---

## 2026-08-17

### Correction session (operator-assisted)

- **[2026-08-17 20:00] CORRECTION-001:** Found F-001 partially started (`package.json`,
  `node_modules`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, an empty `app/`) directly inside
  the compose repo (`ReCOdex/`) root, alongside `docs/*.md`. This violates the brief's "new, empty
  repository" instruction and §1's explicit "do not vendor your frontend's source inside the compose
  repo" — likely happened because F-001 was interrupted before reaching that step. No app code
  existed yet, so nothing was lost. Moved everything (`app/`, `package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `.nvmrc`, `node_modules/`, all of `docs/`, and the brief itself) to a new
  sibling repository at `../recodex-web-next` and git-initialized it there. `ReCOdex/` now contains
  only what it did before this project started (verified: `docker-compose.yaml`, `.env`, `.env.example`
  untouched throughout).
  - _Observations:_ If a future session finds itself about to write a file inside `ReCOdex/` for any
    reason other than the one compose entry (§3 constraint 1), stop and re-read §1 — this is exactly
    how it happened the first time.

- **[2026-08-17 20:15] CORRECTION-002:** Verified four assumptions in `QUESTIONS.md`/`DECISIONS.md`
  (ASS-001, ASS-003, ASS-005, ASS-006) against the actual running deployment (`ReCOdex/.env`,
  `ReCOdex/docker-compose.yaml`, and live requests against the running stack) rather than leaving
  them as generic guesses. All four were wrong:
  - API base was assumed `http://localhost:4000/v1`; actual is `http://recodex.local/api/v1`
    (public) / `http://api:80/v1` (internal, server-side only).
  - CAS was assumed enabled; this deployment has no `EXTERNAL_AUTH_*` configured and
    `LOCAL_REGISTRATION_ENABLED=false` — both flows must still be _built_ (parity), just have
    nothing to point at here yet.
  - Monitor WebSocket was assumed `wss://`; this deployment is plain `http`/`ws` (no TLS yet) —
    proxied at `/ws` by the existing nginx `proxy` service, confirmed running.
  - OpenAPI spec was assumed served at `/v1/api-docs`; a live request confirms it returns 404 —
    `repos/api/docs/swagger.yaml` exists in the api repo's source tree but nginx only exposes `www/`.
    Read the file from disk at codegen time rather than fetching it over HTTP.
    Full detail and how each was checked is in `QUESTIONS.md`'s Resolved section.
  - _Observations:_ Recon was thorough about the legacy **application** but hadn't yet looked at the
    **deployment** it needs to run alongside — both live in "the compose repo" per §1's operator
    inputs. Worth checking early in every future session that touches env/URLs: read `ReCOdex/.env`
    and `ReCOdex/docker-compose.yaml` directly rather than assuming.

- **[2026-08-17 20:45] F-001:** Scaffolded Next.js in `recodex-web-next/` (correct location this
  time): `tsconfig.json` (strict), `next.config.ts` (`output: 'standalone'`, `basePath` from
  `URL_PATH_PREFIX` build-time env, `cacheComponents`/`partialPrefetching` explicitly `false`),
  minimal `app/layout.tsx` + `app/page.tsx`. `npm view next version` confirms `16.3.1` really is the
  latest 16.3.x patch — already what was pinned, no change needed there.
  - _Observations:_ `next build` warned that `experimental.cacheComponents` moved to a top-level
    `cacheComponents` key in this exact version (16.3.1) — fixed by moving it, and added
    `partialPrefetching` at the top level too (same move applies to it). This is precisely the kind
    of drift the brief warns about (§4: "do not trust your training data for Next.js APIs") — worth
    re-checking `next.config.ts` against the bundled docs after any Next.js version bump, not just
    assuming last session's shape still holds.

- **[2026-08-17 21:00] F-002:** `pnpm lint` failed twice while wiring this up, for two unrelated,
  currently-real ecosystem-compatibility reasons (not code bugs):
  1. `typescript-eslint@8.67.0` (latest on npm) hard-errors on load against TypeScript 7 — its own
     peer range is `>=4.8.4 <6.1.0`. Confirmed via `npm view typescript-eslint peerDependencies`,
     not assumed.
  2. `eslint-plugin-react@7.37.5` (latest) throws inside a rule (`getFilename is not a function`)
     against ESLint 10 — its peer range tops out at `^9.7`. `eslint-config-next@16.3.1` itself allows
     `eslint: '>=9.0.0'` with no upper bound, which is how 10.x got installed in the first place.
     Resolution: pinned `typescript@6.0.3` and `eslint@9.39.5` (latest stable in each's supported
     range) instead of the brief's TS7/whatever-eslint-scaffold-picks. `next build`'s own type-checking
     works identically either way — TS7 was chosen for speed, not a capability TS6 lacks. Recorded in
     `AGENTS.md` under "Toolchain deviations from the brief" with the tracking issue for when to revisit
     (`typescript-eslint#10940`). `eslint.config.mjs` ended up importing
     `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly as flat-config
     arrays — that package now ships native flat config, no `FlatCompat` legacy-shim layer needed
     (confirmed by reading `node_modules/eslint-config-next/dist/*.js` directly rather than assuming the
     older compat pattern still applies).
  - _Observations:_ Two real, currently-unresolved upstream compatibility gaps on the very first
    `pnpm lint` run. Worth a periodic check (not urgent) once `typescript-eslint` and
    `eslint-plugin-react` catch up, so the pins in `AGENTS.md` can come back off.

- **[2026-08-17 21:10] F-006:** `.env.example` + `.env.local` created with `API_BASE_PUBLIC`,
  `API_BASE_INTERNAL`, `MONITOR_WS_URL`, `PORT`, `SESSION_COOKIE_PREFIX`, `URL_PATH_PREFIX` — all set
  to the verified values from CORRECTION-002, not placeholders. `API_BASE_INTERNAL` currently equals
  `API_BASE_PUBLIC` (this app isn't on the compose network yet, so the internal service hostname
  isn't reachable from the host during `pnpm dev`) — documented inline in `.env.example` to change to
  `http://api:80/v1` once F-004 gives this app its own compose service entry.

- **[2026-08-17 21:15] Also created `AGENTS.md`**, which the brief's §0 calls for on the first
  session and hadn't been created yet — contains §3/§6/§7/§12 verbatim per the instruction, plus the
  toolchain-deviation note from F-002. Left a marker comment at the end for the version-matched block
  `next dev` writes on first run (not yet run in this session — `pnpm dev` should be tried early next
  session so that block appears and gets left alone afterward, per brief §4).

- **[2026-08-17 21:30] F-003:** Multi-stage `Dockerfile` (deps → builder → runner, `node:22-bookworm-slim`
  matching the Node-based ReCodEx components' base image, non-root `recodex` user). Lives in this
  repo's own root rather than the compose repo's `services/<name>/` pattern — see DECISIONS.md
  DEC-026 for why (this repo isn't one of the `pull-repos.sh`-managed upstream repos, so the
  shared-context reason for that pattern doesn't apply here).
  - _Observations:_ `docker build` succeeded on the first try, but `docker run` immediately crashed:
    `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`. This is a known class of
    issue (pnpm + Next.js standalone output) but the specific fix took two attempts to find:
    1. Tried adding `@swc/helpers` as an explicit direct dependency (the most commonly cited fix
       online) — did not help, same crash.
    2. Tried `outputFileTracingRoot` (the fix for the GitHub-discussion-documented "monorepo symlink"
       variant of this problem) — also did not help, same crash.
    3. Diagnosed properly by diffing `node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/`
       between the full pnpm store and what actually ended up in `.next/standalone`: the tracer copied
       `cjs/` but silently dropped `esm/`, which is what `require-hook.js` actually needs. Fixed with
       `outputFileTracingIncludes: { "/**": ["...@swc/helpers/**"] }`. Verified for real: `docker build`
       then `docker run` then `curl` returning HTTP 200 with the rendered `<p>ReCodEx</p>` page, not
       just "the build didn't error."
  - _Observations:_ Worth remembering for every future dependency that shows this failure mode —
    "@swc/helpers as a dependency" and "outputFileTracingRoot" are both popular answers online for
    this error but were both wrong for this specific case. Diffing the traced output against the real
    pnpm store is what actually found it. If another package crashes the standalone server the same
    way later, check for a missing subdirectory in its traced copy before reaching for either of those
    two "standard" fixes again.

- **[2026-08-17 21:45] F-004:** Compose service entry. Shown to the operator as a diff first per the
  constraint-1 exception; approved as-is (see DEC-028). Applied to `ReCOdex/docker-compose.yaml` (new
  `web-next` service, `build.context: ../recodex-web-next` per DEC-026, `depends_on: [api]`), plus
  `WEB_NEXT_PORT` added to `ReCOdex/.env` and `ReCOdex/.env.example`.
  - _Observations:_ `docker compose up -d web-next` failed the first time — host port `3000` (the
    proposed default) was already bound by something unrelated to this stack (`docker ps` showed no
    compose container using it, so it's a host-level process, not a container collision). Switched
    `WEB_NEXT_PORT` to `3001` and retried; this is a pure renumbering with no behavioural difference,
    so it was fixed and recorded rather than routed back to the operator as a new question. Verified
    for real, not just "container is Up": `docker ps` shows `0.0.0.0:3001->3000/tcp`, `curl
http://localhost:3001/` returns HTTP 200, and `docker exec recodex-web-next-1 getent hosts api`
    resolves the `api` service's container IP — confirming `web-next` is genuinely on the `recodex`
    network and `API_BASE_INTERNAL=http://api:80/v1` is reachable. Updated `.env.example`'s comment
    that had said "change to `http://api:80/v1` once F-004 lands" — it has now landed; that value lives
    in the compose file's `environment:` block, overriding whatever `.env.local` has when run via
    Docker (`.env.local` still governs bare `pnpm dev` on the host, where the internal hostname isn't
    reachable, so it correctly keeps the public URL there).
  - _Observations:_ Did not route `web-next` through `proxy` (no `nginx.conf.template` change) — direct
    host-port publish is simpler for side-by-side dev with the legacy `web-app` and doesn't touch a
    working config file. Revisit when cutover is closer (see DEC-028's rejected alternative).

- **[2026-08-17 22:00] F-005:** CI pipeline. `.github/workflows/ci.yml` runs `typecheck`, `lint`,
  `build`, `test` via `corepack enable` (matching the Dockerfile's own pnpm-acquisition method rather
  than introducing `actions/setup-pnpm` as a second one).
  - _Observations:_ `pnpm test` (`vitest run`) would have failed CI immediately — zero test files
    exist yet (F-023/F-024 not started), and vitest's default behaviour is to exit non-zero on an
    empty suite. Added `vitest.config.ts` with `passWithNoTests: true` so the pipeline is meaningfully
    green now and starts actually enforcing the moment real tests land, rather than either leaving
    `test` out of CI (weakens F-005) or leaving it in and immediately red (noise, trains ignoring CI).
  - _Observations:_ Also added `"type": "module"` to `package.json` — `vitest run` was warning about
    ESM syntax loaded as CommonJS in `vitest.config.ts`. Checked first that no plain `.js` file in the
    repo relies on CommonJS (`find` turned up none; `eslint.config.mjs` was already `.mjs` regardless
    of this), so this was a safe, real fix rather than a cosmetic suppress.
  - _Observations:_ Verified all four steps locally before trusting the workflow file, including the
    one difference CI actually has from local dev: temporarily moved `.env.local` aside and reran
    `pnpm build` to confirm it succeeds without it (it does — this app doesn't read env vars at build
    time yet, only basePath via `URL_PATH_PREFIX`, which defaults to empty). Restored `.env.local`
    afterward.

- **[2026-08-17 22:45] F-025/F-026:** `scripts/seed.ts` + `docs/SEED_ACCOUNTS.md`. Builds 4 groups
  (one with a subgroup, one archived, one pagination-stress), 3 named users covering every
  role/membership combination the brief calls out plus 25 pagination-filler students, one fully
  wired gradeable exercise, and real submissions — all through the public API, all idempotent.
  Verified for real: ran it four times in a row against the live instance (fresh create → rerun →
  bug-fixed rerun → final clean rerun), and the last run produced zero creates (every line was
  `exists, reused` / `already exists, skipping submit`).
  - _Observations:_ Getting one exercise from "created" to "gradeable" via the public API only is
    genuinely a 7-step chain with no shortcut, and the OpenAPI spec alone is too generic (`items:
{}` on every array field) to build it from — had to cross-reference
    `repos/web-app/src/helpers/exercise/configSimple.js`/`configAdvanced.js` for the real `config`
    payload shape, and discover the pipeline/variable IDs by actually calling
    `POST /exercises/{id}/config/variables` against the live instance rather than guessing. Full
    recipe in DEC-029. Confirmed ReCodEx allows assigning the same exercise to a group multiple
    times, so the 25-assignment pagination filler reuses one exercise instead of building 25.
  - _Observations:_ Three real bugs found and fixed via actually running the script against the
    live instance, not just via typecheck/lint:
    1. `getOrCreateUser`'s registration call never forwarded the admin token, so it went out
       unauthenticated and 403'd — `LOCAL_REGISTRATION_ENABLED=false` on this deployment requires a
       privileged caller, not just "any authenticated user" (see `RegistrationPresenter::
checkCreateAccount`).
    2. Tried adding a supervisor as a member of an already-archived group — 403, because
       `becomeMember`'s ACL rule requires `group.isNotArchived`, evaluated against the _target
       user's own role_, not just the actor's. Fixed by moving `ensureArchived()` to run _after_
       all membership calls for that group, not at creation time — see DEC-031's neighbor DEC-030
       reasoning and the dedicated gotcha section in `SEED_ACCOUNTS.md`.
    3. `localizedStudentHints` caused a PHP 500 (TypeError) when sent as `[{locale, text}]` — the
       swagger description's `(locale => hint text)` was the tell; it wants a locale-keyed object
       (`{en: "..."}`), not an array.
    4. First idempotency pass for submissions checked "does _any_ solution exist" rather than
       matching by `note`, so submitting two different solutions (correct + wrong) to the same
       assignment silently dropped the second one on a re-run mid-session. Fixed to match on the
       `note` field, which the API does return verbatim on the solutions-list endpoint.
    5. `GET /exercises` (and `/users`) return a paginated `{items, totalCount, ...}` envelope, not
       a bare array — assumed array first, got a runtime `TypeError`, fixed after checking the
       actual response shape live.
  - _Observations:_ **Genuine pass/fail evaluation cannot be verified on this dev machine.** Every
    submission resolves to an infrastructure `evaluation_failure` ("Isolate init error") because
    this Mac's Docker Desktop runs cgroup v2 only — confirmed via `docker logs recodex-worker-1`
    showing `Checking for cgroup support for memory ... CAUTION`. This is the **same limitation
    `../ReCOdex/README.md` already documents** ("worker needs cgroup v1", explicitly naming
    "macOS/Docker Desktop" as a host where this shows up) — re-discovered, not new. The seed data
    itself is correct (one submission is logically right, one is logically wrong); only the
    resulting UI _evaluation state_ needs re-verification on a cgroup v1 host. See DEC-031.
  - _Observations:_ Also closed out **F-007** while touching `docs/BACKLOG.md` for this — it turned
    out to already be fully done as a side effect of F-003 (`Dockerfile`'s `ARG URL_PATH_PREFIX` +
    `next.config.ts`'s `basePath`, and `DROPPED.md` already documents the build-time limitation).
    Marked done rather than left as a stale `todo` for finished work.

- **[2026-08-18 09:15] F-008:** Turbopack filesystem cache for builds. No config change --
  `turbopackFileSystemCacheForBuild` defaults to `true` (checked the actual default-config export
  in `node_modules/next/dist/server/config-shared.d.ts`, not just the doc comment). Verified it's
  really active, not just nominally on: ran `rm -rf .next` then two consecutive `next build` runs
  -- `.next/cache/turbopack/v16.3.1-*/` filled with real SST/LOG/CURRENT files after the first, and
  the second build's "Compiled successfully" step dropped from 1673ms to 254ms (~6.5x).

- **[2026-08-18 09:40] F-009:** Turbopack memory eviction in dev. No config change --
  `turbopackMemoryEviction` defaults to `'auto'`. Ran a real (short) `next dev -p 3099` session
  (3000 was already taken by another local project's dev server -- unrelated collision, not a bug
  here): hit `/` a few times, then sampled the `next-server` process's RSS before and after 60s
  idle -- 468496 KB down to 359344 KB, a real ~23% drop with no requests in between, consistent
  with `'auto'` eviction actually running.
  - _Observations:_ This is as far as this ticket can meaningfully go right now. A genuine
    "memory stays bounded over hours of heavy use" test needs an app with real route/module
    volume to generate memory pressure in the first place -- this repo still only has the two
    placeholder routes from F-001. Revisit once Design System or Student Experience routes exist.
  - _Observations:_ `next dev`'s first run in this repo auto-appended the version-matched
    `<!-- BEGIN:nextjs-agent-rules -->` block to `AGENTS.md`, exactly where F-002's session left a
    marker comment for it. Committed alongside this ticket rather than left as a dangling
    uncommitted diff, per Next's own guidance in that block's text.

- **[2026-08-18 10:20] F-010:** Theme tokens (dark/light). Tailwind CSS v4 wasn't installed yet at
  all (F-001/F-002 scaffolded plain Next.js only) -- installed as part of this ticket:
  `tailwindcss` + `@tailwindcss/postcss` (v4's CSS-first config, no `tailwind.config.js`) +
  `next-themes` for the `.dark` class toggle. `app/globals.css` defines the full shadcn/ui-named
  token set (`--background`, `--foreground`, `--primary`, ... in `oklch`) for both `:root` and
  `.dark`, mapped onto Tailwind's utility namespace via `@theme inline`. `components/theme-
provider.tsx` wraps `next-themes`' client-only provider; wired into `app/layout.tsx` with
  `attribute="class" defaultTheme="system" enableSystem` and the `suppressHydrationWarning` next-
  themes itself requires. See DEC-032 for the full rationale, including why the token _names_
  specifically match shadcn/ui's own convention (DEC-004 already commits to vendoring shadcn/ui;
  matching names now avoids a rename pass when that lands).
  - _Observations:_ Verified for real, not just "it builds": inspected the actual compiled CSS
    (`.next/static/chunks/*.css`) and confirmed `:root`/`.dark` blocks exist with genuinely
    different values, Lightning CSS auto-downgraded `oklch()` to `lab()`/hex fallbacks, and the
    `@layer base` rules (`body { @apply bg-background text-foreground }`) correctly resolved
    through the custom properties rather than silently no-op'ing. Also started a real `next start`
    and `curl`'d the rendered HTML to confirm next-themes' blocking anti-FOUC script is present and
    carries the exact config passed in `layout.tsx`.
  - _Observations:_ No actual browser click-through was possible or meaningful yet -- I don't have
    browser automation tooling available in this environment, and there's nothing to click besides
    the placeholder page (no toggle UI exists; that's a Design System ticket, not this one). The
    compiled-output verification above is the honest ceiling for this ticket; a human should still
    eyeball light/dark switching in an actual browser once a toggle control exists.
  - _Observations:_ **Found and fixed a real gap in F-005's own CI pipeline while verifying this
    ticket:** ran `pnpm format:check` before committing (habit, not part of F-010's own scope) and
    it failed on 15 files -- the whole repo had never actually been run through Prettier since F-002
    set it up, and `format:check` was never added to `ci.yml` despite existing as a script the whole
    time. Fixed both: `pnpm format` (whitespace/table-alignment only, confirmed via re-running
    typecheck/lint/build/test afterward -- nothing else changed) and added `format:check` as a fifth
    step in `.github/workflows/ci.yml`. Worth remembering: a script existing in `package.json` isn't
    evidence it's actually enforced anywhere.
  - _Observations:_ That first `pnpm format` also reformatted `pnpm-lock.yaml` -- quote style only
    (`'9.0'` -> `"9.0"` etc.), but a ~5100-line diff on a generated file Prettier has no business
    touching, and one that would keep re-fighting pnpm's own writer on every future install. Reverted
    it and added `.prettierignore` (just `pnpm-lock.yaml`, with the reasoning inline), then let `pnpm
install` regenerate the lockfile itself so it correctly picks up F-010's new dependencies
    (`tailwindcss`, `@tailwindcss/postcss`, `next-themes`) using pnpm's own formatting -- a sane
    ~470-line diff instead. Confirmed `pnpm install --frozen-lockfile` (what CI actually runs) still
    succeeds afterward.

- **[2026-08-18 11:10] F-011:** i18n: next-intl with cs/en. `next-intl@4.13.7` installed;
  version/API verified against the actually-installed package's compiled output rather than
  memory (see DEC-033 for specifics -- `defineRouting`'s default `localePrefix`, the plugin's
  default `i18n/request.ts` search path, and, critically, that `next/root-params` (next-intl's own
  documented replacement for the `requestLocale` param it otherwise deprecates) **isn't actually
  usable in the installed Next 16.3.1** -- its files are listed in `next`'s own `package.json`
  `"files"` array but don't exist in `node_modules`). Restructured `app/layout.tsx`/`app/page.tsx`
  into `app/[locale]/layout.tsx`/`page.tsx` -- the `[locale]` layout now **is** the root layout (no
  separate top-level `app/layout.tsx`), `app/globals.css` stays put and is imported with a relative
  path. Added `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts`, and `proxy.ts` (not
  `middleware.ts` -- AGENTS.md footgun 1) wrapping `next-intl/middleware`. `messages/{en,cs}.json`
  started minimal, just the placeholder page's one string -- full legacy message migration is
  explicitly deferred to per-screen S-/T-/D-series tickets, not attempted as a bulk port (the
  legacy files are ~2200 keys/220KB each, using a flat `app.foo.bar` key scheme next-intl doesn't
  use -- only the actual translated _wording_ carries over, not the key structure).
  - _Observations:_ Verified end-to-end for real, three ways: (1) `next build` -- both `/en` and
    `/cs` statically prerendered via `generateStaticParams`, `Proxy (Middleware)` present in the
    route list; (2) a live `next dev` session -- `curl /` with no `Accept-Language` gets a 307 to
    `/en`, with `Accept-Language: cs` gets a 307 to `/cs`, both locale pages render with the
    correct `<html lang>`; (3) a full `docker build` + `docker run` repeating the same checks
    against the actual production standalone container, not just `next dev` -- proxy/middleware
    bundling under `output: standalone` has a real history of subtle breakage in Next.js, so `next
dev` working wasn't treated as sufficient evidence on its own. All three agreed.
  - _Observations:_ Along the way, approved two previously-blocked native build scripts
    (`@parcel/watcher`, `@swc/core`, both transitive via next-intl's optional SWC extractor plugin)
    in `pnpm-workspace.yaml`'s `allowBuilds` -- well-known, widely-used packages, not obscure
    third-party code, so treated the same as the `esbuild`/`unrs-resolver` approvals F-001 already
    had.

- **[2026-08-18 12:05] F-012:** Error/not-found/forbidden conventions.
  `app/[locale]/{error,not-found,forbidden,unauthorized}.tsx` +
  `app/{global-error,global-not-found}.tsx`. Checked the bundled docs first rather than building
  from memory (brief §6 footgun 8's "Since 16.3" framing was the tell that this needed
  verification): `error.tsx`'s `retry` prop has been stable since 16.3.0 and already gives
  route-segment boundaries the same re-fetch-and-re-render recovery `catchError` provides -- the
  docs' own "Good to know" says as much. `catchError` is for component-level boundaries not tied
  to a route segment; none exist yet, so not used. `forbidden()`/`unauthorized()` are marked
  `experimental` in the docs and need `experimental.authInterrupts` in `next.config.ts` -- enabled
  it anyway, since there's no non-experimental way to get a real 403/401 in the App Router and
  ReCodEx is permission-heavy throughout.
  - _Observations:_ **A real surprise found only by testing, not by reading:** hit a bogus URL
    under a valid locale prefix (`/en/bogus-path`) expecting `app/[locale]/not-found.tsx` to
    render -- instead got Next's bare, unthemed built-in 404. The bundled `not-found.js` doc
    explains exactly why: a root layout on a top-level dynamic segment (`app/[locale]/layout.tsx`,
    from F-011) "makes composing a consistent 404 page harder," and names `global-not-found.tsx`
    (also experimental, `experimental.globalNotFound`) as the fix. Added it, re-ran the same
    request, got the themed page. Worth remembering: this class of bug -- the _common_ case
    working differently from the _documented_ case -- doesn't show up in `next build` or
    `tsc`, only in an actual request.
  - _Observations:_ `app/global-error.tsx` and `app/global-not-found.tsx` both bypass the
    `[locale]` tree entirely (no next-intl context, no theme provider -- confirmed in the docs, not
    assumed), so both use hardcoded bilingual (en/cs together) text. This is the one deliberate,
    narrow exception to "no hardcoded user-facing strings": these two pages are exactly where the
    normal i18n machinery itself may be what just failed, or may never have loaded.
  - _Observations:_ Verified all four states for real: added temporary test routes calling
    `forbidden()`, `unauthorized()`, and throwing a plain `Error`, plus a genuinely bogus URL and
    an invalid-locale URL -- checked both the HTTP status (403/401/500/404) and the actual rendered
    text (translated, not just present) for each, in a live `next dev` session and a full `docker
build` + `docker run` against the production standalone container. Deleted the test routes
    before committing; nothing test-only shipped.

- **[2026-08-18 12:50] F-013:** Route skeleton with layouts. `(anon)`/`(app)` route groups under
  `app/[locale]/...` (confirmed in the build output that groups don't add a URL segment --
  `/[locale]/dashboard`, never `/[locale]/(app)/dashboard`). Scoped to the 16 top-level static
  routes named directly in `docs/IA.md`'s sitemap (7 anon: login, register, forgot-password [+
  change], email-verification, accept-invitation, faq; 9 app: dashboard, groups, exercises,
  pipelines, users, submission-failures, system-messages, archive, admin, profile) -- every
  dynamic segment (`/groups/[groupId]`, `/exercises/[id]/edit-config`, ...) deliberately deferred
  to the S-/T-/A-/AD- ticket that will build real data-fetching against it, see DEC-035.
  - _Observations:_ Each stub renders a new shared `components/placeholder-page.tsx` with its own
    translated title. Sourced the Czech titles from the legacy app's actual sidebar/page-title
    strings (`repos/web-app/src/locales/{en,cs}.json`) rather than translating them myself --
    caught a real mismatch this way: "Exercises" is legacy `app.sidebar.menu.exercises` = "Úlohy",
    not the more literal "Cvičení" a from-scratch guess would likely have produced. Also confirmed
    "Administration" → "Administrátor" (not the more obvious "Administrace") and "Pipelines" →
    "Pipeline" (singular Czech form used as the word itself) this way.
  - _Observations:_ Both route-group `layout.tsx` files are deliberate passthroughs
    (`<div>{children}</div>`) with a comment naming the ticket that replaces them -- D-series for
    the real sidebar/PageShell chrome, F-015 for the actual `(app)` access check. Not pre-built
    speculatively.
  - _Observations:_ Verified the same three ways as F-011/F-012: `next build`'s route list (all 16
    routes present, correctly un-prefixed by the route groups), a live `next dev` session (status
    code + actual translated text, not just "renders something," for a sample across both
    locales), and a full `docker build` + `docker run` against the production standalone
    container.

- **[2026-08-18 13:30] F-014:** `proxy.ts` for auth UX redirect. Re-read brief §5 in full before
  writing anything, since this is "the load-bearing decision" and the dependency order is easy to
  misread -- F-014 lands _before_ F-016 (login handler) even exists, which only makes sense once
  you notice `proxy.ts` here only ever checks cookie _presence_, never validates a token. Added
  `lib/auth/session-cookie.ts` (just the cookie-name constant, derived from
  `SESSION_COOKIE_PREFIX`) so F-016's actual `Set-Cookie` can't quietly use a different name than
  what this file checks. Pathnames split three ways -- `AUTH_ONLY_PATHNAMES` (login, register:
  redirect to `/dashboard` if already signed in), `PUBLIC_PATHNAMES` (forgot-password [+ change],
  email-verification, accept-invitation, faq, `/`: reachable either way), everything else (every
  `(app)` route: redirect to `/login?from=<path>` if signed out) -- matched by hand against
  F-013's route-group folders, since route groups never show up in the URL. See DEC-036 for the
  full reasoning, including why `/` itself isn't redirected either direction yet.
  - _Observations:_ The trickiest part was composing this with next-intl's own middleware from
    F-011 in the same file (Next only allows one `proxy.ts`). Solved by running next-intl's
    middleware first and returning its response immediately if _it_ wants to redirect (locale
    detection) -- only applying the auth check once the pathname genuinely has a resolved locale.
    Verified the full chain live, not just each piece in isolation: `curl` on a bare `/dashboard`
    (no locale, no cookie) returns a 307 to `/en/dashboard`; following that redirect lands on
    `/en/login?from=%2Fen%2Fdashboard` -- the two redirects compose correctly end to end rather
    than fighting each other.
  - _Observations:_ Verified all six presence/pathname combinations (app-route and login-page,
    each × cookie present/absent, plus a public page confirmed reachable both ways) with real
    `curl` requests carrying an actual `Cookie` header, in both `next dev` and a full `docker
build` + `docker run` against the production standalone container -- proxy/middleware bundling
    under `output: standalone` already had one real history of subtle breakage in this project
    (F-011's DEC-033), so `next dev` alone wasn't trusted again here either.

- **[2026-08-18 14:10] F-015:** `requireSession()` server-side guard -- the actual authorisation
  boundary (brief §5). `lib/auth/require-session.ts` reads the session cookie, decodes its JWT
  payload (no library needed -- just `Buffer.from(part, "base64url")` + `JSON.parse`, and no
  signature verification, since core-api is the only authority that matters), checks `exp`, and
  redirects to `/login` if anything's wrong. Grounded the JWT shape in a **real token from an
  actual login** (the compose stack is still running from F-025) rather than assuming one: `sub`
  is the user UUID, `exp`/`iat`/`nbf` are the expected Unix-seconds claims, plus `effrole` (null
  normally) and `scopes: ["master","refresh"]` -- both useful groundwork for F-021/F-018 later.
  - _Observations:_ Deliberately **not** wired into `(app)/layout.tsx`. Brief §5 spells this out:
    "Every function that touches core-api calls `requireSession()` itself. Not the caller. Not
    the page. Not the layout. Itself." A layout-level gate would recreate exactly the kind of
    single-choke-point risk the brief spent a paragraph warning about for `proxy.ts`. This means
    F-015 currently has no real call site -- none of F-013's stub pages touch core-api yet, so
    there's nothing to guard until F-022's typed API client and real data-fetching functions land.
  - _Observations:_ Verified anyway, live, via a temporary test route (`app/[locale]/(app)/
test-session/page.tsx`, deleted before this commit -- same pattern as F-012's throwaway
    forbidden/unauthorized/error routes): no cookie (caught upstream by `proxy.ts`, confirming the
    two layers compose correctly), a real valid JWT copied from an actual `docker` login (returned
    the correct `{token, userId}`), a JWT-shaped-but-deliberately-expired token (redirected), and
    a garbage non-JWT cookie value (redirected). The expired and malformed cases are the ones that
    actually prove this function does something `proxy.ts`'s shallow presence check doesn't.

- **[2026-08-18 15:00] F-016:** Auth BFF: login Route Handler. Before writing anything, re-read
  brief §5 closely and found a real, standing error: `docs/DECISIONS.md`'s DEC-023 said login and
  logout were Server Actions, directly contradicting the brief's own words ("Login: Route Handler
  receives credentials...") and `docs/BACKLOG.md`'s own F-016/F-017 titles -- a recon-phase
  mistake that had gone uncorrected. Fixed DEC-023 in place before implementing, same as the
  ASS-001/003/005/006 corrections earlier in this project.
  - `app/api/auth/login/route.ts`: `{email, password}` in, mapped to core-api's own `username`
    field internally (confirmed live core-api has no separate "username" concept -- it's just
    the field name). Validated with `z.email()`, not the deprecated `z.string().email()` chain --
    caught by actually checking zod 4.4.3's installed type defs rather than writing from
    v3-era memory, which would have gotten this wrong.
  - New `sessionCookieOptions(maxAgeSeconds?)` in `lib/auth/session-cookie.ts`: derives `secure`
    from `API_BASE_PUBLIC`'s URL scheme, not `NODE_ENV` -- this deployment genuinely runs "in
    production" over plain HTTP right now (no TLS cert yet), so `NODE_ENV`-based logic would set
    `secure: true` and silently break every login, exactly the failure mode brief §5 calls out by
    name. Cookie `maxAge` is derived from the real JWT's `exp` claim, not a guessed constant --
    extracted the payload-decoding logic F-015 already had into a shared `lib/auth/jwt.ts` once
    this second real use appeared, rather than duplicating it.
  - _Observations:_ Verified thoroughly and repeatedly, not just "the build passes": correct
    credentials (200, and inspected the raw `Set-Cookie` header byte-for-byte -- exactly the right
    `Max-Age`, no `Secure` flag, matches this plain-HTTP deployment), wrong password (401, core-
    api's own message passed through), malformed/missing input (400, Zod). Then the full round
    trip with a real cookie jar: log in, save the cookie, use it against `proxy.ts` (F-014, no
    redirect), use it against `requireSession()` (F-015, correct `{token, userId}`), confirm
    `/login` itself now redirects away since we're "logged in" -- first in `next dev`, then again
    against the actual production compose container talking to `api` over the internal Docker
    network (`http://api:80/v1`), not the dev-mode fallback URL. Every piece built across
    F-014/F-015/F-016 now demonstrably works together, not just in isolation.

- **[2026-08-18 15:45] F-017:** Auth BFF: logout Route Handler. `app/api/auth/logout/route.ts` --
  POST only (logout is a mutation; a GET-triggered logout is a CSRF footgun even if low-severity
  here), clears the session cookie, 303s to `/login`. Confirmed first that core-api has no
  logout/invalidate endpoint at all (only `/login`, `/login/refresh`, `/login/takeover` exist in
  `docs/swagger.yaml`) and that the legacy app's own logout is a pure local Redux action with no
  API call -- so this is correctly BFF-side only, nothing to tell core-api.
  - _Observations:_ **Found and fixed a real, previously-invisible bug while verifying this in
    Docker (not just `next dev`).** Built the redirect the same way every other redirect in this
    codebase is built -- `new URL("/login", request.url)` -- and it worked perfectly in `next
dev`. Under the actual `output: standalone` container, the resulting `Location` header pointed
    at `http://0.0.0.0:3000/login`, the container's own internal bind address, not the address the
    browser was actually using. Tracked it down with a temporary debug endpoint (not committed)
    that echoed both `request.url` and the raw `Host` header side by side: `Host` was correct
    (`localhost:3001`), `request.url` was not. `proxy.ts`'s `request.nextUrl` does not have this
    problem (F-014's verification stands). Tried a relative `Location` header as a simpler
    workaround -- also failed, `NextResponse.redirect()` throws `"Please use only absolute URLs"`
    at runtime despite its parameter being typed to accept a plain string. Fixed properly: build
    the absolute URL from `request.headers.get("host")` instead, same protocol-derivation as
    F-016's `sessionCookieOptions()`. Recorded as DEC-039 with an explicit warning for later: any
    future code building an absolute URL from `request.url` inside a Route Handler needs the same
    re-verification against a real standalone build, not just `next dev` -- this is the third time
    in this project a real behavioural gap has only shown up under the production build config
    (after F-011's `@swc/helpers` tracing gap and F-012's `global-not-found` gap), which is
    exactly the pattern the project's own habit of always testing standalone Docker builds, not
    just `next dev`, exists to catch.
  - _Observations:_ Verified the full round trip again after the fix, in both `next dev` and the
    production compose container: login, confirm the cookie works, logout, confirm the `Set-Cookie`
    correctly expires it (`Expires=Thu, 01 Jan 1970...`), confirm the redirect chain lands on the
    real themed login page, confirm the protected route is blocked again afterward.

- **[2026-08-18 16:30] F-018:** Auth BFF: token refresh in `proxy.ts`, the concurrent-refresh race
  guard. `lib/auth/refresh-session.ts`'s `maybeRefreshSession()`, called from `proxy.ts` and
  applied to whichever response it ends up returning (not just the pass-through case), refreshing
  proactively once less than 24h remains on the token's `exp` (tokens last 7 days by default).
  De-duplication is a module-scope `Map<token, Promise>` -- correct within one running Node.js
  process, which matches this deployment's current single-instance shape (ASS-004); noted in
  DECISIONS.md as a real limitation if that ever changes, not silently assumed away.
  - _Observations:_ First live test against core-api's real `/login/refresh` produced a genuinely
    useful surprise: **refreshing does not invalidate the old token** -- both the pre- and
    post-refresh tokens kept working afterward. This changes the actual failure mode from the
    brief's literal wording ("must not... invalidate each other") to "waste a redundant upstream
    call" -- still worth guarding against, just less severe than the brief's phrasing implies for
    _this specific API_. Documented rather than silently noted, since it's the kind of thing a
    future session could easily get wrong if it re-reads only the brief and not this decision.
  - _Observations:_ Second surprise, more consequential for how I had to verify this at all:
    core-api's JWTs are **second-granularity deterministic** -- HMAC-SHA256 over a payload whose
    only varying claim is `iat`, so two refresh calls landing in the same wall-clock second
    produce a byte-identical token. My first concurrency test (6 parallel requests) "passed" by
    every response carrying the same token -- which would also have been true if de-duplication
    were completely broken and all 6 requests happened to land in the same second. Caught this
    before trusting the result, and re-verified properly by counting actual upstream calls via
    temporary logging (not committed): exactly **one** `POST /login/refresh` for all 6 concurrent
    requests, all resolving in ~150ms. Also verified the negative case with the real threshold
    restored: a freshly-issued 7-day token correctly triggers no refresh at all.
  - _Observations:_ Verified the normal (non-refresh) login/protected-route path still works
    correctly in the production compose container after adding this logic, though didn't repeat
    the full concurrent-refresh dance there specifically -- the refresh call reuses the exact
    `API_BASE_INTERNAL` fetch pattern already proven Docker-safe by F-016, and the cookie-setting
    reuses `sessionCookieOptions()` already proven Docker-safe by F-016/F-017, so the marginal risk
    of a new Docker-specific bug in _this_ ticket's own logic was judged low enough not to warrant
    re-running the same multi-rebuild verification cycle a third time.

- **[2026-08-18 12:22] F-019:** Auth BFF: external-auth (CAS-and-similar) callback Route Handler.
  `app/api/auth/external/[authenticatorName]/callback/route.ts`. The brief describes this loosely
  ("exchanges the ticket with core-api"), and the legacy app's own code disagrees with itself --
  `cas.js` is a CUNI-specific popup + client-side CAS `serviceValidate` flow keyed on a `ticket`
  param, but the page actually wired into the login flow, `LoginExternFinalization.js`, just reads
  a `token` param and relays it. Rather than guess which model to follow, read core-api's own PHP
  source (`ExternalServiceAuthenticator.php`'s `decodeToken()`) directly: core-api never contacts
  CAS or any external provider itself -- each `authenticatorName` has a pre-shared `jwtSecret`
  configured server-side, and core-api's whole job is verifying a signature on whatever token this
  route hands it. So the route is a generic `[authenticatorName]` dynamic segment (matching
  core-api's own `/login/{authenticatorName}`), reads `token` from the query string, POSTs it to
  core-api, and reuses F-016's `establishSession()` on success -- extracted into
  `lib/auth/session-cookie.ts` for this second call site, same as `buildAbsoluteUrl()` (new
  `lib/http/absolute-url.ts`) was extracted from F-017's logout handler. Any failure (missing
  token, non-2xx from core-api, undecodable token) redirects to `/login?externalAuthError=1`
  rather than throwing. See DEC-041.
  - _Observations:_ The one open technical question going in was whether `request.url` is safe to
    read for its query string specifically, given DEC-039 already proved its _host_ portion is
    wrong under `output: standalone`. Verified live in a rebuilt Docker container (temporary
    logging, not committed, precisely because this is where the original DEC-039 bug was found):
    `request.url` showed the container's internal bind address as expected (`0.0.0.0:3000`), but
    the path and query string were intact -- `new URL(request.url).searchParams.get("token")` read
    a real, distinctive test token correctly. So only the origin is unreliable under `standalone`,
    not the rest of the URL; this route reads `request.url` directly for the query string but still
    routes every redirect through `buildAbsoluteUrl()` for the origin, per DEC-039.
  - _Observations:_ Confirmed the regression risk from refactoring login/logout to share
    `establishSession()`/`buildAbsoluteUrl()` was a non-issue: both routes retested live (dev and
    Docker) and behave identically to before the refactor.
  - _Limitation, not a bug:_ the actual success path (a validly-signed external token reaching
    `establishSession()`) is unverifiable end-to-end in this environment -- no `EXTERNAL_AUTH_*` is
    configured at all (`docs/QUESTIONS.md` Q-004), so there's no way to obtain a real signed token.
    What's verified is everything short of that: the failure paths, the code reuse from an
    already-verified success path (F-016's login), and the query-string safety under `standalone`.
  - Corrected a stale recon-phase assumption in `docs/IA.md` (~line 310), which had guessed a
    CUNI-specific `/login/extern-finalization/:service` → `/api/auth/cas/callback` shape before any
    of this was actually investigated.

- **[2026-08-18 13:05] F-020:** Auth BFF: user takeover, superadmin only.
  `app/api/auth/takeover/[userId]/route.ts`, a `POST` mirroring core-api's own
  `POST /v1/login/takeover/{userId}` 1:1 (`[userId]` path segment, not a body field -- same
  reasoning as F-019's `[authenticatorName]`). Response shape matches login and the external
  callback (`{payload: {accessToken, user}}`), so it reuses the same `establishSession()`. This
  route enforces exactly one thing itself -- that some caller session exists (401 if not) -- and
  forwards it as `Authorization: Bearer <token>`; whether _that_ caller may take over _this_ target
  is entirely core-api's decision, confirmed directly in `repos/api/app/config/permissions.neon`
  rather than assumed from BACKLOG.md's "Superadmin only" note: `takeOver` is allowed only for
  `role: superadmin`, with an explicit `allow: false` catch-all underneath specifically to stop a
  wildcard rule from accidentally granting it to anyone else. A non-superadmin's attempt surfaces
  as a JSON 403, not a redirect to `/login` -- deliberately different from the no-session case,
  since the caller _is_ legitimately logged in here, just not allowed to do this one thing. See
  DEC-042.
  - _Observations:_ Verified live end-to-end against the real seeded accounts
    (`docs/SEED_ACCOUNTS.md`), in both `next dev` and a rebuilt Docker `standalone` container, by
    decoding the resulting session cookie's JWT after each call rather than just checking HTTP
    status: superadmin (`admin@admin.com`) taking over `alice.student@seed.recodex.local` produces
    a `200` whose new session cookie's `sub` claim is genuinely alice's user id, not just a
    plausible-looking success response; the same student attempting to take over the superadmin
    gets a `403` with core-api's own "Access denied" message; no session cookie at all gets a `401`
    before any core-api call is even made; a syntactically invalid `userId` gets a `400` from this
    route's own `z.uuid()` check, also before reaching core-api; a well-formed but nonexistent
    `userId` gets a `404` forwarded straight from core-api.
  - _Observations:_ Unlike F-019, this ticket's real end-to-end success path (not just the code
    reuse) is fully verifiable in this environment -- both accounts involved already exist from
    F-025's seed data, so there was no equivalent of F-019's "can't obtain a real signed token"
    gap here.

- **[2026-08-18 13:35] F-021:** Auth BFF: restricted (application) token generation.
  `app/api/auth/restricted-token/route.ts`, `POST /login/issue-restricted-token`. Before writing
  anything, checked the legacy app for how this endpoint is actually used and found two genuinely
  different consumers: `GenerateTokenForm.js` (a self-service "Generate Application Token" form
  that displays the raw token for the user to copy into external scripts, doesn't touch the
  current session) and `restrictEffectiveRole()` (a sidebar "view as role X" toggle that replaces
  the current session with the narrower token). Scoped this ticket to only the first -- nothing in
  this repo's docs had already committed to the effective-role-switch UX, so building it now would
  be scope creep past what F-021 actually asks for; left as a future ticket for whenever the
  sidebar/dashboard work needs it (it would just add its own `establishSession()` call on top of
  this same route's response).
  - _Deliberate exception to DEC-021:_ this route returns the raw generated token in its JSON
    response body -- the one place in the whole auth module that hands client JS a real token.
    DEC-021 ("client components never see the token") is about the BFF's own httpOnly session
    cookie; this is a different, user-requested credential explicitly meant to leave the app, same
    idea as a GitHub personal access token. Documented as DEC-043 so a future reader doesn't
    mistake this for a leak.
  - `scopes` is validated only as "a non-empty array of strings," not against a hardcoded copy of
    core-api's `TokenScope` list -- core-api's own `validateScopeRoles()`/`validateEffectiveRole()`
    already authoritatively reject forbidden scopes and unknown role names, and duplicating that
    list here would just be one more thing to keep in sync (same reasoning DEC-042 used for
    takeover's authorization).
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    against `alice.student@seed.recodex.local`: a `{scopes: ["read-all"], expiration: 3600}`
    request returns a token whose decoded payload carries exactly `scopes: ["read-all"]` (not
    `master`/`refresh`), and -- checked explicitly, not assumed -- the caller's own session cookie
    is byte-for-byte unchanged before and after. Also verified core-api's own validation errors
    forward correctly rather than getting swallowed: `change-password` scope gets its 403 ("can
    only be issued through the password reset endpoint"), an unknown `effectiveRole` gets a 400,
    and `master` scope with an expiration past the 1-week cap gets its own specific 403 message --
    all three forwarded verbatim, not replaced with a generic error. No session gets 401; an empty
    `scopes` array gets 400 from this route's own Zod check before ever reaching core-api.

- **[2026-08-18 14:20] F-022:** Typed `server-only` API client. `lib/api/client.ts`, the
  foundational piece every future data-fetching ticket builds on. Brief §4's own table says to
  generate types from OpenAPI via `openapi-typescript` when available -- core-api has a real
  `swagger.yaml` (`repos/api/docs/swagger.yaml`), so vendored a copy into this repo at
  `openapi/core-api.yaml` (CI only checks out this repo, no cross-repo access, so codegen input
  has to live here) and added a `pnpm generate:api-types` script producing
  `lib/api/core-api.generated.ts`.
  - Before committing to a design, actually inspected the generated output rather than assuming
    the usual `openapi-fetch` combo (generated types + its typed-fetch runtime) was the right
    move: core-api's `swagger.yaml` has **zero response schemas anywhere** -- confirmed directly,
    all ~250 response definitions are literally `description: 'Placeholder response'`, no
    `content`/`schema`, no `components.schemas` section at all in the 7409-line file. Request
    bodies and path params _do_ generate real, useful shapes (confirmed for several endpoints --
    `issue-restricted-token`'s generated `scopes: unknown[]` matches F-021's own hand-written Zod
    schema exactly), but every response resolves to `never`. Since a caller has to supply the
    real response type `T` by hand regardless (same as every auth route has already been doing),
    `openapi-fetch`'s core value proposition doesn't apply -- skipped it, hand-wrote the client
    instead, and typed only `path` against `keyof paths` (a genuine compile-time guarantee the
    endpoint exists and is spelled right) while leaving `pathParams`/`query`/`body` as plain
    `Record`/`unknown`.
  - `openapi-typescript`'s peer range is `typescript: ^5.x`; this repo is pinned to `6.0.3`
    (F-002's toolchain deviation). `pnpm add` and `pnpm peers check` both warn, but actually
    running the codegen produces correct output regardless -- verified by running it, not assumed
    safe from the warning alone.
  - Normalizes core-api's fixed envelope (`{success, error: {message, code, parameters},
payload}`, confirmed against `ApiErrorPresenter::sendErrorResponse()`) into an `ApiError`
    class. `code` is deliberately the short string (`"403-002"`), not the PHP constant name --
    confirmed by reading `FrontendErrorMappings.php`'s actual constant _values_, and matches
    exactly what the legacy app's `apiErrorMessages.js` keys its own localised message table on.
    That table itself isn't built by this ticket -- `code`/`parameters` are just correctly
    surfaced and ready for whichever later ticket adds the next-intl equivalent.
  - _Bug found and fixed live, not caught by typechecking:_ `API_BASE_INTERNAL` already includes
    a `/v1` prefix (every existing auth route depends on this: `${apiBase}/login`), and every
    generated `paths` key is _also_ `/v1`-prefixed from core-api's own root -- naive concatenation
    silently produced a `/v1/v1/users/...` URL that 404s with a slightly misleading
    `{code: "400-000", message: "Bad Request"}` (core-api's generic Nette-routing-exception
    fallback, not the ACL/not-found error it looks like at a glance). Fixed by stripping the
    leading `/v1` from the resolved path inside the client rather than touching what
    `API_BASE_INTERNAL` means everywhere else. See DEC-044.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    via a temporary debug route (not committed): a real `GET /v1/users/{id}` call for the caller's
    own id, reached through `requireSession()` → `apiGet()`, returns the exact live payload
    (matches a raw `curl` of the same endpoint, checked side by side); a syntactically valid but
    nonexistent id correctly throws `ApiError` carrying core-api's real `httpStatus: 404`,
    `code: "404-000"`, and message, not a generic failure.

- **[2026-08-18 14:55] F-023:** Playwright smoke harness skeleton (brief §8's "main safety net").
  `playwright.config.ts` + `e2e/{smoke.spec.ts, helpers/{accounts,auth,base-url}.ts}`.
  - Checked `@next/playwright` (brief §4 mentions it for its `instant()` helper) before installing
    it, rather than assuming it was a drop-in: its own published README states it requires Cache
    Components, which this repo deliberately has off (DEF-001 -- essentially every byte here is
    per-user and permission-dependent). Used plain `@playwright/test` instead.
  - No login form exists yet (`/login` is still F-013's `PlaceholderPage`), so the harness logs in
    via the real Auth BFF `POST /api/auth/login` (F-016) directly. Runs against a real `next
build` + `next start`, not `next dev` -- dev mode's extra warnings aren't representative of
    what ships, and DEC-039's `request.url` bug only ever reproduced in a production `standalone`
    build. Confirmed (not assumed) that `next start` still loads `.env.local`
    (`node_modules/next/dist/docs/.../environment-variables.md`: skipped only when
    `NODE_ENV=test`), so it points at the same local core-api as every other verification step.
  - _Three real bugs hit and fixed while building this:_
    1. A first draft of the debug route used a leading-underscore directory
       (`app/api/_debug-f022/`) and silently 404'd -- Next's private-folder convention excludes
       `_`-prefixed segments from routing entirely. Same lesson as F-022's own verification;
       renamed and moved on.
    2. `test.use({storageState: path})` declared at `describe` scope turned out to silently
       become the default for _any_ context Playwright creates within that scope -- reproduced
       live with both `browser.newContext()` and `playwright.request.newContext()` called from
       inside the very `beforeAll` meant to create that file, both throwing `ENOENT` reading it.
       Not documented behaviour I could find in the bundled types; found by testing, not by
       reading. Fixed by dropping `storageState` entirely: log in with a plain `fetch()` (no
       Playwright context involved at all) and inject the resulting cookie into each test via
       `context.addCookies()` in `beforeEach` instead.
    3. Even after that fix, 3 of 48 tests failed intermittently with the _server's own_
       `ConnectTimeoutError` to `recodex.local:80` -- the default CPU-core worker count (7, on
       this machine) sent enough concurrent bcrypt-hashing logins to the local `docker compose`
       stack's PHP-FPM pool to genuinely exceed core-api's own request handling capacity within
       the fetch timeout. Confirmed via the Next.js server's own log output, and confirmed core-api
       itself never logged a single non-200 during the same window -- the requests were queuing,
       not failing, until the client gave up. Not a code bug; fixed with `workers: 2`, verified
       stable across several repeated full runs afterward.
  - Also found and fixed a Vitest/Playwright collision: Vitest's own default include glob matched
    `e2e/smoke.spec.ts` and tried to run it as a unit test, failing immediately since
    `test.describe()` refuses to run outside Playwright's own runner. Excluded `e2e/**` in
    `vitest.config.ts`.
  - **Deliberately not wired into CI** (`.github/workflows/ci.yml` unchanged): these tests need a
    real, reachable core-api, and GitHub Actions' runner has neither one nor a way to stand one up
    from this repo alone (core-api/mysql/etc. live in the separate `ReCOdex` compose repo). Meant
    to be run locally (`pnpm test:e2e`) against a developer's own running stack. See DEC-045.
  - _Observations:_ Final state, verified stable across repeated runs: 48/48 tests pass -- 8
    anonymous public routes, plus 4 seeded personas (`docs/SEED_ACCOUNTS.md`) each visiting all
    10 protected `(app)` routes with a real session cookie -- watching for console errors, page
    errors, failed requests, and unexpected 4xx/5xx, with a screenshot per route landing in the
    already-gitignored `screenshots/`.

- **[2026-08-18 15:20] F-024:** Token-leakage security test, the brief's §8 "one security test,
  non-negotiable": assert the auth cookie is httpOnly, and that the raw token appears nowhere in
  served HTML or client bundles. `e2e/security.spec.ts`.
  - Deliberately does **not** reuse F-023's login helper as-is: `loginAndGetCookie()` +
    `context.addCookies({httpOnly: true, ...})` manually _sets_ `httpOnly` for rendering
    convenience, so asserting on that cookie afterward would just check a flag this test itself
    wrote -- a tautology. Uses `page.request.post()` directly instead, so Playwright parses the
    real `Set-Cookie` header the server actually sent, flags included. Finds the session cookie
    by diffing `context.cookies()` before/after login rather than assuming its name
    (`SESSION_COOKIE_PREFIX` is deployment-configurable) or shape.
  - Two tests: (1) the cookie's `httpOnly` flag is `true`, plus a follow-up check that
    `document.cookie` genuinely can't see the value from inside the page's own JS -- the practical
    consequence, not just the attribute; (2) the raw token string appears in neither the full
    rendered HTML of any protected route nor any served JavaScript response body (captured via a
    `page.on("response")` listener filtering on `content-type: .../javascript`).
  - _Observations, the part worth calling out:_ Before trusting either assertion, deliberately
    forced each to fail once and confirmed it actually did, rather than assuming a passing test on
    the first try meant the check was real. Flipped the HTML assertion to check for the string
    `"html"` (guaranteed present) -- it failed, with the full captured page source in the error
    output, proving `page.content()` really is being inspected. Flipped the httpOnly assertion to
    expect `false` -- it failed with `Received: true`, proving the real server-set cookie really
    does carry the flag. Reverted both immediately afterward and reran the real assertions clean.
    Given the brief's own "non-negotiable" framing, a security test that has never been observed
    to fail is exactly the kind of thing that could be silently broken -- worth the extra few
    minutes here specifically, more than most other tickets.
  - Extracted `PUBLIC_ROUTES`/`APP_ROUTES` out of `smoke.spec.ts` into a shared
    `e2e/helpers/routes.ts` now that this ticket gave them a second consumer.
  - See DEC-046.

- **[2026-08-18 15:45] D-001:** `PageShell` component, the first Design System (Phase 2) ticket --
  Foundation (F-001 through F-026) is now fully complete. `components/page-shell.tsx`, matching
  `docs/IA.md` §3.3's `PageShellProps` interface exactly (`title`, `subtitle?`,
  `breadcrumbs: BreadcrumbItem[]`, `actions?`, `tabs?`, `children`). A plain Server Component --
  `actions`/`tabs` are pre-built `ReactNode`s the caller supplies, so nothing here needs
  `"use client"` of its own. `breadcrumbs` is required but this component does not resolve it;
  that's explicitly D-002's job (the central manifest with async entity-name resolvers), kept
  deliberately separate so this component stays a pure presentational layer. Reused the existing
  shadcn-style CSS tokens from `app/globals.css` and `@/i18n/navigation`'s `Link` (not
  `next/link`, for automatic locale-prefixing) -- no new dependencies.
  - Wired into `components/placeholder-page.tsx` (F-013's shared stub-page shell, currently used
    by all 18 real routes) with a single, unlinked breadcrumb crumb, as the fastest way to verify
    `PageShell` renders correctly across the whole live app today rather than waiting for the
    individual S-/T-/A-/AD- tickets that eventually replace each stub.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container:
    the full 50-test E2E suite (F-023/F-024) passes unchanged with `PageShell` now in every
    route's render path -- no new console errors, hydration mismatches, or unexpected status
    codes. Also built a temporary debug route (not committed) exercising the prop surface
    `PlaceholderPage` alone doesn't touch: `subtitle`, `actions` (two buttons), `tabs` (two
    links), and a two-crumb breadcrumb with one _linked_ (non-current) crumb -- confirmed all
    render, and specifically confirmed the linked crumb produces a correctly locale-prefixed
    `href="/en/groups"`, not a bare `/groups`.
  - **Backlog gap found and corrected while reading `docs/IA.md` §3 for this ticket**: the
    Navigation Model section describes four things (§3.1 sidebar, §3.2 breadcrumb manifest, §3.3
    PageShell, §3.4 command palette), but the Design System phase only ever ticketed two of them
    (D-001 PageShell, D-002 breadcrumb manifest) -- the sidebar and command palette were never
    given ticket numbers at all. `(app)/layout.tsx`'s own existing comment already anticipated
    this ("D-series... owns the real sidebar + PageShell chrome") without naming which ticket.
    Added D-014 (sidebar/app-shell navigation) and D-015 (command palette) to close the gap,
    rather than silently folding sidebar work into this ticket's own scope or leaving it
    untracked. D-014 specifically notes that the sidebar's "My Groups"/"My Teaching" sections
    need real per-group-membership API data that no earlier ticket fetches yet, so it likely needs
    sequencing relative to whichever ticket first lists a user's groups.
  - See DEC-047.

- **[2026-08-18 16:10] D-002:** Central breadcrumb manifest. `lib/breadcrumbs/manifest.ts`, per
  footgun #12: "A central route manifest mapping segments to labels, including async resolvers
  for entity names... Every page renders breadcrumbs through it. No page builds its own."
  - Design: a flat registry of `{namespace, pattern}` (static) or `{pattern, resolve}` (dynamic,
    `:param`-templated) entries. `resolveBreadcrumbs(pathname, locale)` walks every _prefix_ of
    the pathname (so `/forgot-password/change` produces two lookups, one per segment), matches
    each prefix against the registered patterns, and resolves a label -- via next-intl's
    `getTranslations({locale, namespace})` for static entries, via the entry's own async
    `resolve()` for dynamic ones. Throws for any unregistered prefix rather than silently
    omitting a crumb -- confirmed live with a temporary page using an unregistered namespace,
    which produced a clean 500 with the exact message, not a silently broken page.
  - Deliberately left every nested dynamic segment from `docs/IA.md` §3.2's own examples
    (`/groups/[groupId]`, `/assignments/[id]`, `/solutions/[id]`, `/exercises/[id]`) unregistered:
    no page for any of them exists yet, and their entity-name resolvers depend on group/
    assignment/exercise response shapes no ticket has confirmed. The `resolve` field's type
    signature is in place for whichever future ticket builds that route to fill in -- registering
    a guessed resolver now would risk being wrong and needing rework.
  - Wired into `components/placeholder-page.tsx` via a new `resolveBreadcrumbsForNamespace()`
    entry point: since every stub page already self-identifies by next-intl namespace, reusing
    that same string as the manifest's own lookup key let all 17 stub `page.tsx` files simplify
    mechanically -- each now just `<PlaceholderPage namespace="Groups" />`, no longer needing to
    be `async` or import `getTranslations` itself. `PlaceholderPage` now does one resolution and
    reuses the breadcrumb chain's own last crumb as the `<h1>` title, so title and breadcrumb can
    never drift apart (previously two separate, coincidentally-matching translation calls).
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container:
    the two-segment `/forgot-password/change` route renders a real two-crumb chain -- "Reset
    password" linked to a correctly locale-prefixed `/en/forgot-password` (via `PageShell`'s
    `@/i18n/navigation` `Link`), then "Change forgotten password" as the unlinked current page;
    all 17 single-segment routes render their one crumb correctly; the full 50-test E2E suite
    (F-023/F-024) passes unchanged.
  - See DEC-048.

- **[2026-08-18 16:50] D-003:** `DataTable` component. `components/data-table.tsx`, brief
  §9/§10's "DataTable (sort/filter/paginate/URL sync/bulk select)". Read the legacy
  `repos/web-app/src/components/widgets/SortableTable` first (brief: "source code is your
  primary reference," not a screenshot or a guess) rather than designing from scratch: it
  sorts/paginates entirely client-side over an already-fetched array, which is a reasonable model
  to keep (no entity-listing ticket exists yet to know whether core-api supports server-side
  pagination per list), but persists sort order in `localStorage` with no URL state at all --
  deliberately corrected that part, since brief §9 explicitly wants "Sharing a URL reproduces the
  exact view." Sort/filter-query/page sync to `${id}-sort`/`${id}-q`/`${id}-page` in
  `searchParams`; row selection stays local React state on purpose -- transient bulk-action UI,
  not a bookmarkable view, and an unbounded ID list doesn't belong in a URL.
  - _Two real bugs, both found by actually building and testing, not assumed away:_
    1. A first debug version passed `columns` (containing `cell`/`sortValue`/`filterValue`
       function props) from a Server Component straight into `<DataTable>` -- a genuine
       "Functions cannot be passed directly to Client Components" runtime error, since a function
       can't cross the RSC serialization boundary. Documented prominently in the component's own
       doc comment: the correct shape is a Server Component that fetches `data` and a small
       `"use client"` wrapper that defines `columns` and renders `<DataTable>` -- every future
       S-/T-/AD- list-view ticket will need to follow this shape.
    2. Both `next dev` and even a local ad-hoc `next build` (run once without the debug route
       present) looked completely clean. Rebuilding the Docker image with the debug route present
       failed at prerender: "useSearchParams() should be wrapped in a suspense boundary." `next
dev` has no static-generation step to enforce this, so it never caught it -- only a real
       production build did, specifically the Docker build this project already treats as
       authoritative (the same category of dev/prod divergence as DEC-039's `request.url` bug).
       Fixed by having `DataTable` wrap its own `useSearchParams()`-reading implementation in an
       internal `<Suspense fallback={null}>`, so no future caller needs to remember this.
  - _Observations:_ Re-verified specifically against a rebuilt Docker `standalone` container after
    the `Suspense` fix, not just `next dev`, given how bug #2 was found: sort cycles correctly
    through ascending -> descending -> cleared across three header clicks, each reflected in the
    URL; pagination advances and updates the URL; a debounced filter narrows the dataset and
    composes correctly with pagination (11 matches at `pageSize: 10` -> exactly 10 rows shown,
    resets to page 1); clearing the filter restores the full set; selecting a row toggles its
    checkbox and leaves the URL completely unchanged; the header "select all" checkbox selects
    every row on the current page. Full 50-test E2E suite passes unchanged.
  - See DEC-049.

- **[2026-08-18 17:05] D-003 follow-up:** Re-reading brief §4 while starting D-004 turned up a
  real gap in D-003: the stack table names "Tables: TanStack Table, in client leaves" as the
  chosen library, and that was never actually investigated before shipping D-003's hand-rolled
  implementation. Installed `@tanstack/react-table@9.1.2` (current latest) and read its own
  bundled skill docs before deciding anything, rather than assuming from memory (the exact
  discipline this project's own AGENTS.md Next.js-version warnings already establish).
  - _Finding:_ v9 is a substantial rewrite from the `useReactTable({data, columns,
getCoreRowModel: getCoreRowModel()})` API the brief's phrasing almost certainly assumed. V9
    requires explicit, headless feature registration (`useTable({features, columns, data})`,
    with sorting/filtering/pagination/even reactivity as opt-in plugins passed to
    `tableFeatures({...})` before their state exists at all) -- confirmed directly from the
    bundled docs, which themselves flag "copying the v8 constructor" as a high-severity common
    mistake. Critically, none of it reduces this component's actual hard part: TanStack Table has
    no built-in URL-sync in any version, so the `searchParams` wiring D-003 already built would be
    exactly as much custom code on top of TanStack Table's controlled-state API as on top of the
    hand-rolled version -- the whole benefit of adopting it would be capabilities (virtualization,
    column pinning/grouping/faceting) no current ReCodEx list view needs, for the cost of learning
    an entirely new headless paradigm.
  - _Decision:_ Keep D-003's hand-rolled implementation. Uninstalled `@tanstack/react-table`
    afterward (not left as an unused dependency). Documented as DEC-050 -- the same category of
    decision as F-002's TypeScript 6.0.3 pin: a brief-specified choice investigated properly and
    found impractical for a verified reason, not skipped by assumption. If a future ticket's real
    needs genuinely call for a headless table engine's specific capabilities, that ticket should
    evaluate the then-current TanStack Table on its own merits rather than this decision reaching
    backward for an old version now.

- **[2026-08-18 17:20] D-004:** Form kit on Server Actions. `lib/forms/{action-result,
use-server-action-form, use-dirty-guard}.ts`, `components/form/{text-field, form-error}.tsx`.
  Brief §4/§9/§10: "React Hook Form + Zod (shared schema), submitting through a Server Action";
  BACKLOG.md D-004: "field, error surfacing, pending state, dirty guard". Checked
  `react-hook-form@7.85.0`/`@hookform/resolvers@5.9.1` compatibility first, with D-003's TanStack
  Table lesson still fresh -- both installed cleanly with no version surprises this time.
  - `useServerActionForm()` wires `useForm` to a Zod schema via `zodResolver`, then calls the
    given Server Action **directly as a function** from `handleSubmit`'s callback rather than via
    Next's native `<form action={serverAction}>`/`useActionState` pattern -- RHF already owns
    submission (validation, dirty tracking, its own `handleSubmit`), so the two models would
    conflict over the same submit event. The action dispatch itself is wrapped in
    `startTransition`, per Next's own bundled forms guide, since it's invoked outside
    `<form action>`. Server-side failures map onto RHF's own error model: `fieldErrors` become
    per-field `form.setError()` calls, `formError` becomes RHF's `root` pseudo-field (confirmed
    genuinely supported by reading `react-hook-form/dist/types/errors.d.ts`, not invented for this
    ticket).
  - `TextField` covers text-shaped inputs only (text/email/password/number/search); other shapes
    deliberately left for whichever ticket first needs one, same "don't build speculatively"
    reasoning as D-002's deferred dynamic breadcrumb resolvers.
  - `useDirtyGuard` covers `beforeunload` (full page unload/refresh/tab-close) only. Checked the
    bundled Next.js docs for an in-app navigation-blocking primitive (the App Router equivalent of
    React Router's `useBlocker`) before deciding to skip it, rather than assuming it doesn't exist
    -- found none as of 16.3. Documented as a real, checked gap rather than papered over with a
    fragile custom Link-click interceptor that would need to independently rediscover every way a
    navigation can start.
  - _One real bug, the same category as D-002/D-003's:_ a first version defined the Zod schema in
    the same file as the `"use server"` action (natural, given "shared schema"). This produced a
    genuine runtime error -- `zodResolver` throwing "Invalid input: not a Zod schema" -- because a
    `"use server"` file's compiler pass only handles (async) function exports; the co-located
    schema silently becomes something else by the time the client imports it. Fixed by moving the
    schema into its own plain module, imported by both the client form and the action file, and
    documented prominently in `use-server-action-form.ts`'s own doc comment so this doesn't get
    rediscovered the same way next time.
  - _Observations:_ Verified live in both `next dev` and a rebuilt Docker `standalone` container
    (given D-002/D-003's pattern of Docker-only failures, checked there specifically rather than
    assuming `next dev` success would carry over) via a real demo Server Action exercising all
    four paths in one flow: client-side Zod validation (empty submit shows a field error, no
    server round trip); a server-only field error a client schema alone couldn't produce; a
    server-only form-level (`root`) error; a success path; and the dirty-guard's tracked state
    genuinely flipping from clean to dirty on input.
  - See DEC-051.

- **[2026-08-20 10:00] Repo relocation (compose-repo side):** Not a ticket -- the operator wanted to
  move development to another machine and asked, from the compose repo, for a single-command
  bootstrap (clone the compose repo, run `pull-repos.sh`, `docker compose up`, get everything
  including this frontend). At their explicit direction, this repo's checkout location moved from
  a `../recodex-web-next` sibling directory to `<compose repo>/repos/web-next/`, fetched by the
  compose repo's own `pull-repos.sh` the same way it fetches the upstream ReCodEx repos (gitignored
  there, independent of this repo's own remote name). This repo's own git history/remote
  (`git@github.com:jurja00/codeUp-web-ui.git`) is completely unaffected -- verified nothing here
  changed on this repo's side; the change is entirely in how the compose repo checks this repo out.
  - Checked this doesn't reopen `docs/QUESTIONS.md` Q-003's original violation (F-001 once
    scaffolding this app's actual source into the compose repo's own git-tracked tree) -- it
    doesn't, since `repos/` is gitignored by the compose repo, so nothing about this repo's source
    ever enters the compose repo's own git history. Added a note to Q-003 and a full explanation as
    DEC-052 so a future session doesn't mistake this for a regression and try to "fix" it back to a
    sibling directory.
  - Fixed the now-stale `../ReCOdex/...`-style relative path references this repo's own docs/
    comments had accumulated (`docs/DECISIONS.md`, `docs/SEED_ACCOUNTS.md`,
    `lib/auth/session-cookie.ts`, `scripts/seed.ts`) to say "the compose repo's ..." instead --
    robust to this or any future relocation, matching the pattern `AGENTS.md` already used
    elsewhere. Left this file's and `docs/BACKLOG.md`'s own historical entries (describing what was
    true when they were written) untouched, since rewriting an append-only log's past entries would
    misrepresent history rather than fix a stale pointer.
  - Added an explicit note to the top of `AGENTS.md` (the file read first every session) stating
    the compose repo is now two directories up (`../../`) from here, not a `../ReCOdex` sibling.
  - _Observations:_ Verified live from the compose repo side: a real `pull-repos.sh` run correctly
    cloned this repo into `repos/web-next` via SSH, and `docker compose build web-next && docker
compose up -d web-next` succeeded end to end from that new location.

- **[2026-08-21 09:15] D-005:** Upload component + Route Handlers. `lib/upload/{limits,
chunked-upload,use-file-upload}.ts`, `components/upload/file-upload.tsx`,
  `app/api/upload/partial/route.ts`, `app/api/upload/partial/[id]/route.ts`,
  `app/api/upload/[id]/digest/route.ts`, `Upload` strings in both locales, plus a
  `readSessionToken()` helper in `lib/auth/session-cookie.ts`.
  - _Brief §6.7's open question, answered:_ "If the legacy app chunks large uploads, find out and
    reproduce that." **It does.** `repos/web-app/src/redux/modules/upload.js` +
    `containers/UploadContainer/UploadContainer.js` drive core-api's per-partes protocol:
    `POST /uploaded-files/partial {name,size}` → `PUT /uploaded-files/partial/{id}?offset=N` with
    the raw chunk as the body → `POST /uploaded-files/partial/{id}` to finalize →
    `GET /uploaded-files/{id}/digest` compared against a locally recomputed SHA-1 →
    `DELETE /uploaded-files/partial/{id}` to cancel. Chunk size is adaptive (64 KiB start, doubled
    after a chunk under 2 s, halved after one over 4 s, clamped to 4 KiB–4 MiB). Cross-checked
    against `UploadedFilesPresenter` rather than trusting the legacy client alone -- that's where
    the offset rule (core-api rejects any offset ≠ its own `uploadedSize`) and the raw-body
    handling (`saveRequestBodyAsFile()` reads `php://input`, no multipart wrapper) come from.
  - _The one real design decision:_ the chunk loop runs in the **browser**, with each chunk
    proxied through a Route Handler, rather than shipping the whole file to a Route Handler that
    chunks server-side. Both readings satisfy §6.7's wording; only the first gives real progress
    (a server-side loop can only report browser→Next transfer), cancel that stops work in flight,
    and a checksum check that means anything -- comparing core-api's digest against bytes _we_
    sent it verifies nothing, since both sides come from the same copy. Documented as DEC-053.
  - _512 MiB ceiling:_ verified, not assumed -- the compose repo's `services/proxy/
nginx.conf.template` + `services/api/nginx-site.conf` (`client_max_body_size 512M`) and
    `services/api/php-recodex.ini` (`upload_max_filesize`/`post_max_size`). Notably core-api's own
    `actionStartPartial()` permits **1 GiB**, so the deployment, not the API, is the binding
    constraint. ASS-007 accordingly retired from DECISIONS.md's assumptions table as verified.
  - _One deliberate divergence from the legacy app:_ local digest verification degrades to a skip
    when `crypto.subtle` is missing instead of failing the upload. `crypto.subtle` only exists in a
    secure context, so on plain HTTP reached by hostname (`http://recodex.local:3001` -- this very
    deployment) it is `undefined` and the legacy app throws a bare `TypeError` there. The file is
    already complete and durable by that point; failing it over a check the browser cannot perform
    is the worse of the two behaviours.
  - _Two things the lint config caught that are worth remembering:_ `react-hooks/refs` rejects the
    "latest callback in a ref, assigned during render" pattern outright, and
    `react-hooks/set-state-in-effect` rejects the usual "notify the parent from an effect, guarded
    by remembered state" workaround. Both went away by moving the parent notification into
    `useFileUpload` itself and firing it from the completion/remove/reset handlers -- real event
    contexts, no effect involved. The rules were right; the first two designs were the habit.
  - _Observations (verified live against the running stack):_ end to end on a bare-host
    `next build && next start`, a 300 KiB file uploaded in 5 chunks and core-api's returned SHA-1
    matched the local file's byte for byte. Negative paths all behave: unauthenticated → 401 JSON
    (not a redirect, which is why `readSessionToken()` exists), 513 MiB → `400-004`, `bad/name.zip`
    → `400-003`, non-UUID id → 400, wrong offset → core-api's own "offset must correspond" 400,
    `DELETE` → `OK` followed by 404 on a later complete. Then re-verified **inside the Docker
    `standalone` image** (`docker compose build web-next && up -d`, port 3001) -- same protocol,
    same matching digest -- given D-002/D-003's history of Docker-only failures. The component
    itself was driven in a real browser via a temporary demo page + Playwright: a multi-chunk
    upload reaching the "Uploaded" state, and a 200 MiB upload cancelled mid-flight with the row
    disappearing. Demo page and its spec removed afterward, same as D-004's demo Server Action.
  - See DEC-053.

- **[2026-08-21 10:05] D-006:** Dialog/modal system. `components/dialog/{dialog,confirm-dialog}.tsx`,
  `Dialog` strings in both locales, dialog motion tokens + a `prefers-reduced-motion` rule in
  `app/globals.css`.
  - _Package:_ the unified `radix-ui` (1.6.7) rather than `@radix-ui/react-dialog`. Checked the
    React 19 peer range before installing (DEC-050's lesson, applied without being prompted this
    time). The rest of the Design System phase needs several more primitives from the same family
    (D-007 toasts, D-015 command palette, dropdowns/tooltips); one version that moves together
    beats a dozen drifting ranges, and the traced output is per-primitive either way.
  - _`ConfirmDialog` is built on `AlertDialog`, not `Dialog`_ -- brief §9's "destructive actions
    confirm" needs `role="alertdialog"`, initial focus on Cancel, and **no** outside-click
    dismissal. All three confirmed by reading the installed
    `@radix-ui/react-alert-dialog/dist/index.js` (it overrides `onPointerDownOutside` and
    `onInteractOutside` with `preventDefault()`, and focuses its own `cancelRef` on open), not
    from the docs site and not from memory.
  - _Two details that would have been wrong if written from memory_, both checked against the
    installed `@radix-ui/react-dialog@1.1.23`: (1) `aria-describedby` is already set to
    `descriptionPresent ? descriptionId : undefined`, so the `aria-describedby={undefined}`
    workaround every older Radix guide prescribes is obsolete -- writing it in would have been
    harmless but misleading; (2) this version ships **no `console` calls whatsoever**, so the
    famous "DialogTitle is required" warning no longer fires. A forgotten title would now be a
    silent accessibility failure, which is why `title` is a required prop here rather than a
    convention -- the compile error replaces the warning Radix used to give.
  - _One real bug, and it was only visible in a screenshot:_ the enter/exit keyframes first
    animated `transform: translate(-50%, -50%) scale(0.97)`. Tailwind v4 centres the dialog with
    `-translate-x-1/2 -translate-y-1/2`, which compile to the standalone **`translate`** property,
    not to `transform` -- so both applied, and the dialog flew in from half a dialog-width
    off-centre. Nothing in the typecheck, the lint or the passing e2e assertions caught it; the
    screenshot did. Fixed by animating the standalone `scale` property, which composes with
    `translate`. Worth remembering as a general Tailwind v4 fact, not a dialog-specific one.
  - _Observations (verified in a real browser against the running stack):_ dialog opens with the
    right accessible name and description, `Tab` cycles without escaping the dialog, `Escape`
    closes it and focus returns to the trigger. The confirm dialog focuses Cancel on open, ignores
    a click on the backdrop, and only resolves on a deliberate choice. Demo page and its spec
    removed afterward -- D-013 (`/dev/kitchen-sink`) is the ticket that owns a permanent home for
    exercising these in isolation.
  - See DEC-054.

- **[2026-08-21 10:40] D-013:** `/dev/kitchen-sink`. `app/[locale]/dev/kitchen-sink/page.tsx` +
  `components/dev/kitchen-sink.tsx`, `KitchenSink` strings in both locales, one new entry in
  `proxy.ts`'s `PUBLIC_PATHNAMES`.
  - Taken out of backlog order (D-007 was next) at the operator's explicit request: they wanted a
    page they could keep open in a browser to watch the design system take shape. D-013 already
    existed as an unblocked ticket for exactly this, so this is a reordering, not a new scope.
  - Page is a Server Component; everything interactive lives in a single `"use client"` island
    (brief §6.4). Deliberately outside both route groups and public in `proxy.ts` -- it renders no
    user data and calls no user-scoped endpoint, so a session requirement would only get in the
    way. The upload section is the one exception (it genuinely talks to core-api) and says so in
    its own note rather than failing mysteriously for a signed-out viewer.
  - Replaces the throwaway demo pages D-003 through D-006 each had to build and delete; the next
    component ticket should extend this page instead.
  - _Observations:_ verified live in the Docker container on port 3001 (not just the bare-host
    build), in dark mode: table sorting/paging/selection, the form kit's field and form-level
    error states, both dialogs opening and closing, and the upload dropzone rendering its 512 MiB
    ceiling.

- **[2026-08-21 11:20] D-007:** Toast notification system. `components/toast/toast-provider.tsx`,
  mounted once in `app/[locale]/layout.tsx`; `Toast` strings in both locales; toast motion tokens
  in `app/globals.css`.
  - On Radix `Toast` (1.2.23), continuing DEC-054's package choice. Radix is doing real work here
    beyond styling: `role="status"` with `aria-live` picked by toast type (`assertive` for
    foreground, `polite` for background -- read out of the installed source), auto-dismiss timers
    that pause on hover and on window blur, swipe-to-dismiss, and the F8 focus hotkey that makes
    toasts keyboard-reachable at all.
  - Errors are `foreground`/8 s, successes `background`/4 s: a success confirms something the user
    already expected, an error is news they have to act on.
  - `useToast()` **throws** outside the provider rather than returning a no-op -- a toast that
    silently does nothing is precisely the silent failure brief §9 forbids, and it would only ever
    be noticed in production, on the error path, by a user.
  - _Observations:_ verified in the Docker container on port 3001 -- error toast renders
    bottom-right with destructive styling, title, description and a working dismiss control.

- **[2026-08-21 11:25] D-013 follow-up (route rename):** `/dev/kitchen-sink` →
  `/dev/design-system`, with the component renamed to match and `proxy.ts`'s public-path entry
  updated. The operator read the route, said they had no idea what "kitchen sink" meant, and asked
  whether there was a better name. There was: the term is genuinely standard in design-system
  tooling (Storybook, MUI and Bootstrap all ship "kitchen sink" pages, which is where the recon
  ticket got it), but a name only a frontend specialist can parse is a bad name for a page whose
  entire purpose is being looked at. `/dev/` still marks it as tooling rather than product.
  DEC-020's original wording is left as written -- it records what was decided then.

- **[2026-08-21 12:10] D-008:** State components. `components/state/{status-state,skeleton,
empty-state,error-state,error-boundary}.tsx`; `app/[locale]/{error,not-found,forbidden,
unauthorized}.tsx` rewritten onto them; `loading.tsx` added per route group; `Error.description`
  in both locales; a `prefers-reduced-motion` rule for skeletons.
  - One `StatusState` layout sits behind every one of these states. Brief §9 wants them _designed_
    rather than improvised per screen, and one component is the only way they stay identical as
    screens get built. It is deliberately presentational and server-safe -- three of the four route
    pages are Server Components.
  - `loading.tsx` at the **route-group** level rather than copied into every page folder: a
    `loading.tsx` covers all segments nested beneath it, so `(app)` and `(anon)` each get one file
    and every page in them a designed loading state. A screen needing a differently-shaped skeleton
    can still add one closer to its leaf.
  - `ErrorBoundary` wraps `catchError` from `next/error` for panel-level failures (AGENTS.md
    footgun 8). Checked it actually exists in the installed next@16.3.1 before building on the
    brief's word, and read the bundled `catchError.md`: `retry()` re-fetches inside a Transition
    (preserving client state outside the boundary) while `reset()` only clears state without
    re-fetching, and `redirect()`/`notFound()` pass through instead of being swallowed the way a
    hand-written React boundary would swallow them.
  - Its props type is `object`, not `Record<string, never>`: `catchError` returns
    `ComponentType<P & {children?: ReactNode}>`, and a `never`-valued index signature makes that
    intersection reject its own children. Small, but it is the kind of thing that reads as a
    library bug if you meet it cold.
  - _Two things the lint config was right about, again:_ the first version of the showcase's demo
    panel cleared a parent flag during render, and the second reached for module-level mutable
    state (`react-hooks/globals`). Both were attempts to fake a recovering error boundary. The
    honest version -- a "break it" button and a separate "repair it" button, with `retry()` in
    between -- is simpler _and_ shows the real behaviour: retry on a still-broken panel fails
    again, exactly as it should.
  - _One copy bug found by looking rather than reading:_ the shared error state said "this **page**
    could not be loaded", which is visibly wrong when it renders inside a single failed panel on
    an otherwise working page. Now "this content".
  - _Observations:_ verified in the Docker container on port 3001 -- skeletons, the empty state
    with its action, and the panel-level boundary catching a real thrown error while the rest of
    the page (including toast and dialog state) kept working, then genuinely recovering on retry
    once the cause was removed.

- **[2026-08-21 13:15] D-009:** Code viewer with line anchoring. `components/code/code-viewer.tsx`,
  `lib/code/{highlight,languages}.ts`, Shiki styles in `app/globals.css`, `Code` strings in both
  locales, plus a section on `/dev/design-system`.
  - Shiki 4.4.3, **server-side only** (brief §4's stack table). The highlighter is created once per
    server process and held as a promise so concurrent first requests share one initialisation
    rather than racing to start several; grammars are restricted to the languages the extension map
    can actually produce, not Shiki's full bundle.
  - The extension→language table is ported from the legacy app's own `syntaxHighlighting.js`, not
    invented: students upload these extensions today, and a mapping that disagrees would silently
    change how their own solutions look. Prism-flavoured ids translated where the two differ
    (`markup` → `html`/`xml`, `c_cpp` → `c`/`cpp`); `bison` dropped, Shiki has no grammar for it.
    All 26 resulting ids were verified by actually loading them, not by trusting the list.
  - Dual theme via `defaultColor: false`, which emits `--shiki-light`/`--shiki-dark` on every token
    and leaves the choice to CSS keyed on next-themes' `.dark` class. `light-dark()` was the
    alternative and is the wrong one here: it keys off the CSS `color-scheme` property, not the
    class this app toggles, so an explicitly chosen theme would not follow it.
  - Line anchors are real `<a>` elements inside each line (a CSS counter cannot be linked, focused
    or opened in a new tab), `user-select: none` so copying the code does not carry the numbers
    along, and `:target` does the highlighting -- so a deep link works in the server-rendered HTML
    before any JavaScript runs.
  - _One bug the page found and the code did not:_ the `:target` rule lost the cascade. The usual
    Shiki dual-theme snippet paints a background on **every** span, `.line` included, at a higher
    specificity than `.line:target` -- so the linked line looked identical to the rest and nothing
    but looking at it would have said so. Fixed by painting a background only on the block itself
    and giving the target rule selectors that genuinely win. Third bug in this phase that only a
    screenshot or a computed style caught, after the dialog centring and the "this page"/"this
    content" copy.
  - Files over 512 KiB render unhighlighted (and say so) rather than tying up a server process
    tokenising a generated file nobody reads line by line -- uploads are allowed up to 512 MiB.
  - _Deliberately not built:_ per-line review comments and collapsed unchanged regions, both of
    which the legacy `SourceCodeViewer` has. They belong to the solution-review ticket; the
    `id`/`data-line` attributes it will need exist now because line anchoring is _this_ ticket.
  - _Observations:_ verified in the Docker container -- `id="L1"`... present in the raw server HTML
    (so highlighting really is server-side), and `#L5` highlights line 5 while line 6 stays
    untouched, checked via computed style rather than by eye.

- **[2026-08-21 14:05] Improvements pass** (operator asked for improvements found along the way,
  not only ticket work). Three real gaps, all fixed:
  - **F-027, dependency automation was simply missing.** Brief §4: "Add Renovate or Dependabot on
    day one, with `next` and `react-server-dom-*` grouped together." Nothing existed, and the
    subject appears nowhere in `BACKLOG.md`, `DECISIONS.md` or `DROPPED.md` -- so it was an
    oversight during Foundation rather than a recorded deferral. Added `.github/dependabot.yml`
    with the grouping the brief asks for, plus react/radix/dev-tooling groups and the CI actions.
    Dependabot rather than Renovate because Renovate needs a GitHub App installed on the account,
    which is the operator's decision to make and not something this repo can provision for itself.
  - **D-016, no regression net for the design system.** D-003 through D-009 each built a
    throwaway demo page, verified by hand, and deleted it -- six components with nothing behind
    them that would notice a regression. D-013's showcase is permanent and public, so one spec
    (`e2e/design-system.spec.ts`) now covers all of it: dialog Escape + focus restoration, the
    confirm dialog's no-outside-dismiss guarantee, toasts, the error boundary containing a real
    thrown error and recovering on retry, and server-side highlighting with working line anchors.
    It needs no login, so it costs none of the bcrypt round trips `playwright.config.ts` had to
    reduce its worker count for.
    - _Found while writing it:_ Radix renders an off-screen announcer (`<span role="status"
aria-live="assertive">`) duplicating each toast's text. A `role="status"`-scoped lookup lands
      on that copy, which contains no dismiss button, and a loose text match resolves to two
      elements. Noted in the spec so the next person doesn't spend a test timeout on it.
  - **`INVENTORY.md`'s status column had gone stale.** Five mechanism rows (auth token storage,
    token refresh, external auth, takeover, restricted tokens) still said `todo` although F-016
    through F-021 shipped them. A status column that lies is worse than no status column --
    `AGENTS.md` tells every session to read the INVENTORY rows its ticket touches. Corrected, with
    the implementing ticket named in each row; also corrected two rows that said "Server Action"
    where the thing actually built is a Route Handler.

- **[2026-08-21 15:30] D-010:** Markdown renderer. `components/markdown/markdown.tsx`,
  `lib/markdown/legacy-compat.ts`, `lib/markdown/legacy-compat.test.ts` (the repo's first unit
  tests), markdown styles in `app/globals.css`, a section on `/dev/design-system`, and matching
  assertions in `e2e/design-system.spec.ts`.
  - _Brief §7's instruction was followed literally_ -- "render a sample of real exercise texts both
    ways early and log the differences; do not discover them during parity sweep." 16 constructs
    were rendered through the legacy renderer (`markdown-it` at its defaults +
    `@iktakahiro/markdown-it-katex`, matching the legacy widget's own configuration) and through the
    candidate pipeline, side by side, in a scratch harness outside the repo so no comparison-only
    dependency landed in it. **10 of 16 differed.**
  - _Two would have damaged authored content:_
    - **Raw HTML disappeared entirely.** Legacy runs `html: false`, which escapes and _shows_ raw
      HTML. react-markdown without `rehype-raw` _drops_ it: `<div class="note">Read
<b>carefully</b>.</div>` rendered as nothing, and `<kbd>Enter</kbd>` rendered as the bare word
      "Enter". Fixed by converting those nodes to text. Deliberately not fixed with `rehype-raw`,
      which would start _executing_ markup the legacy app has always shown as inert -- a new
      injection surface in supervisor-authored content, seen by every student opening the
      assignment.
    - **`It costs $5 and $10` became mathematics.** `remark-math` recognises `$...$` far more
      eagerly than markdown-it-katex. The legacy rules were measured, not guessed: no whitespace
      immediately inside the delimiters, and `$$` is display math only when it stands alone
      (mid-sentence `$$x$$` is literal text). Both reproduced by inspecting each node's original
      source span.
  - _The rest are additive and accepted, not fixed:_ GFM autolinks bare URLs, renders task lists as
    checkboxes, and supports footnotes -- none of which legacy did; `<del>` instead of `<s>`;
    numeric entity re-encoding (identical rendering). All recorded in DEC-055 rather than left to
    be rediscovered.
  - _The unit tests earned their keep immediately_ -- this repo's first, and they caught three real
    bugs in the plugins before anything was rendered: `remark-math` trims the node value, so
    checking `node.value` for whitespace can never distinguish `$ x $` from `$x$` (the raw source
    span has to be read); a hand-built block-level `math` node arrives without the
    `data.hName`/`hProperties` remark-math attaches at parse time and renders as nothing (flipping
    the existing node's class to `math-display` is the actual fix); and the two visitors match the
    same nodes, so the second silently reverted the first's work until it learned to skip
    already-labelled display math.
  - _One failure that only the running application could show:_ react-markdown executes its plugin
    pipeline **synchronously**, so the ordinary async `@shikijs/rehype` plugin dies at request time
    with `runSync finished async. Use run instead`. `typecheck`, `lint` and `build` were all green
    -- the route renders per request, so the build never exercised it. Fixed by awaiting D-009's
    shared highlighter in the component and handing the instance to `@shikijs/rehype/core`'s
    synchronous entry point. Fourth bug this phase that only running the thing caught.
  - _Observations:_ verified in the Docker container -- prices stay prose, `<b>this</b>` shows as
    written with no live `<b>` element in the DOM, a lone `$$...$$` paragraph renders as display
    math while `$\varphi$` stays inline, tables render, and fences are Shiki-highlighted.
  - See DEC-055.

- **[2026-08-21 16:20] D-011:** Status badges. `components/status/{badge,evaluation-badge,
deadline-badge}.tsx`, `lib/status/evaluation.ts` + `lib/status/evaluation.test.ts`, `--success`
  and `--warning` theme tokens, `Status` strings in both locales, a section on
  `/dev/design-system`.
  - _The evaluation logic is a port, not a design._ Read out of the legacy `SolutionStatusIcon`'s
    decision tree and kept in that order, because the order is the meaning: a missing submission or
    a `failure` is an infrastructure failure, a missing `evaluation` means it is still running,
    `initFailed` means compilation failed before any test ran, and only then does the score mean
    anything. Also ported the non-obvious case where a zero-point assignment greys out unless the
    solution was explicitly accepted -- without it, every zero-point assignment reads as a failure.
  - Kept as a pure function with unit tests rather than branching inside a component: three of the
    six outcomes are infrastructure failure modes that cannot be produced on demand, and this
    machine cannot produce real pass/fail results at all (DEC-031), so tests are the only place
    this logic is exercised until a cgroup v1 host exists.
  - **The theme had no `--success` or `--warning` tokens** -- the base set it started from only has
    `destructive`. Status colouring is exactly where a hardcoded green would otherwise appear
    first, so both were added in light and dark, with chroma and lightness matched to `destructive`
    so the three read as one family (brief §9: "never hardcode a colour").
  - _Deadline state is client-only, deliberately._ Whether a deadline has passed depends on the
    current time, so a server render and a client render legitimately disagree -- the exact
    hydration trap AGENTS.md §6.6 singles out ("ReCodEx is full of deadlines"). Implemented with
    `useSyncExternalStore`, whose server snapshot is `null`: React reconciles the two without a
    warning, and the badge appears a frame late rather than appearing wrong. Not on a ticking
    interval either: a badge that silently flips while the page sits open would be a lie the moment
    the user acts on it, and core-api authorises the submit path regardless of what it says.
  - _The lint config was right a third and fourth time:_ `useState` + an effect (the obvious way to
    do "client-only value") is `setState` inside an effect, and `Date.now()` in the showcase's
    render is an impure call in a component. Both rejected; both had better answers
    (`useSyncExternalStore`, and fixed timestamps that also stop one demo state quietly expiring).
  - _Not built:_ permission badges, the third item in this ticket's line. They need real ACL fields
    from `canSubmit`/`canViewDetail`-style permission hints, and no screen consuming them exists
    yet -- the same "don't build speculatively" reasoning as D-004's deferred input shapes.
  - _Observations:_ verified in the Docker container -- all seven evaluation states and all three
    deadline states render with the right tones, no hydration warning in the console.

- **[2026-08-21 17:10] D-012:** Formatters. `lib/format/points.ts` + `lib/format/points.test.ts`,
  `components/format/{date-time,relative-time}.tsx`, an explicit `timeZone` in `i18n/request.ts`,
  a section on `/dev/design-system`.
  - **The time zone was the real find, and it was a latent bug rather than a missing feature.**
    `i18n/request.ts` set no `timeZone`, so next-intl falls back to the runtime's own zone: a date
    formatted in a Server Component would use the _container's_ zone (UTC) while the same date
    formatted in the browser uses the user's. That is a hydration mismatch in general and, on a
    deadline, a wrong answer rather than a cosmetic one -- and it would have gone unnoticed until
    the first assignment screen shipped, since nothing rendered a date until now.
  - Pinned to the deployment's zone (`APP_TIME_ZONE`, default `Europe/Prague`) rather than trying
    to detect the user's. That is also the more _correct_ behaviour here, not merely the more
    convenient: a deadline announced as 23:59 means that wall-clock time to everyone discussing it
    -- student, supervisor, and the assignment text itself -- and showing a student abroad "22:59"
    would be technically accurate and practically confusing. Verified live: a `21:59Z` deadline
    renders as `Sep 1, 2026, 11:59 PM` in `en` and `1. 9. 2026 23:59` in `cs`.
  - Relative time is client-only, same `useSyncExternalStore` shape as D-011's deadline badge and
    for the same reason -- it is a function of _now_, so any server render or cached HTML is stale
    the moment it is reused. It always carries the absolute value as `dateTime` and a tooltip: "in
    3 days" is friendlier, but a student deciding whether to start tonight needs the timestamp.
  - `formatPercent` **floors** rather than rounds. Rounding to nearest lets a solution that passed
    99.6% of its tests display as "100%", which in a grading tool reads as "everything passed" and
    is the single number a student is most likely to challenge. Out-of-range scores are clamped
    rather than trusted -- `score` comes from the evaluation pipeline, and a malformed one should
    not render as "-300%".
  - _Observations:_ verified in the Docker container in both locales -- absolute dates in Prague
    wall-clock from the server, relative times resolving in the browser, points and percentages
    matching the unit tests.

- **[2026-08-21 18:05] D-014:** Sidebar / app-shell navigation -- the gap found during D-001, when
  `PageShell` shipped and it became clear nothing owned the frame it sits inside.
  `components/app-shell/{app-shell,sidebar-nav}.tsx`, `lib/api/{current-user,groups}.ts`,
  `lib/i18n-text/localized.ts`, `Nav` strings in both locales, `e2e/app-shell.spec.ts`, and
  `(app)/layout.tsx` finally stops being a passthrough `<div>`.
  - _Section visibility follows the IA's rule, not the convenient one._ `docs/IA.md` §3.1 is
    explicit that "My Groups" and "My Teaching" derive from per-group membership arrays rather than
    the global role, and are not mutually exclusive -- someone supervising one course while taking
    another sees both. `GET /v1/users/{id}/groups` returns exactly that split
    (`student`/`supervisor`), and filters archived groups out itself, confirmed in
    `UsersPresenter::actionGroups`. "My Teaching" is hidden entirely when empty (IA: "only if any
    exist"); "My Groups" stays visible but empty, because it tells a new student where their
    courses will appear.
  - _Three API facts checked against a live response rather than inferred_: there is no
    `/users/me` (passing `me` as the id fails core-api's own uuid validation), the role lives at
    `privateData.role` and not at the top level, and groups carry **no** top-level `name` -- names
    come from a `localizedTexts` array keyed by locale. That last one got its own helper
    (`localizedName`) since every screen showing a group, assignment or exercise will need it; it
    falls back to the first available translation rather than rendering an empty, unclickable row.
  - Data is fetched in the Server Component and only finished labels cross into the client island,
    which handles collapse, the phone drawer and active state. Active state uses
    `aria-current="page"`, not colour alone, and is derived from `usePathname()` so it is right on
    first paint and after a browser back. Note it must be the **locale-aware** `usePathname` from
    `@/i18n/navigation`; `next/navigation`'s returns `/en/groups` and would match nothing.
  - The admin section is a role check and deliberately nothing more -- core-api authorises every
    admin route itself, and brief §3.4's "a hidden button is not authorisation" cuts both ways.
  - _Observations:_ verified against the container as a signed-in superadmin -- all sections
    render, the current page carries `aria-current`, clicking through moves it, and at 390px the
    sidebar collapses behind a disclosure button with correct `aria-expanded`. An unauthenticated
    `/en/dashboard` still redirects to `/en/login?from=...`, so wiring the shell into the layout
    did not weaken the gate.

- **[2026-08-21 19:00] D-015:** Command palette. `components/command-palette/command-palette.tsx`,
  `app/api/search/route.ts`, `Palette` strings in both locales, `e2e/command-palette.spec.ts`.
  **Phase 2 (Design System) is complete.**
  - _The IA asked for an endpoint that does not exist._ §3.4 names "`/api/search` (or equivalent)",
    and brief §3.2 forbids inventing endpoints. Checked: core-api has no `/search`, and no
    `/v1/assignments` collection either. A `search` query parameter does exist on `/v1/users`,
    `/v1/exercises` and `/v1/groups` -- verified live, not from the spec file. So the palette
    searches those three, and **assignment search is not built at all**, recorded as Q-011 rather
    than faked or silently dropped.
  - _The three endpoints do not agree on a response shape:_ `/users` and `/exercises` return a
    paginated envelope (`{items, totalCount, offset, limit, ...}`) while `/groups` returns a bare
    array. Normalised once in the Route Handler, so that inconsistency never reaches the UI -- and
    so the browser makes one request instead of three and learns none of it.
  - _Permission comes from core-api, not from a role check here._ The IA restricts user search to
    teachers/admins. Rather than reimplementing that rule, the route attempts it for everyone and
    treats a 403 as "no user results" -- a student gets a working palette without a people section,
    and this app cannot drift from what core-api actually permits (brief §3.4).
  - `cmdk` for the palette itself, same reasoning DEC-054 used for Radix: this is a combobox, and
    combobox semantics (`aria-activedescendant` moving through options while focus stays in the
    input, listbox/option roles, arrow and Home/End handling) look finished long before they are
    correct for a screen-reader user. `cmdk` renders through Radix's Dialog, so it stays in the
    same primitive family. `shouldFilter={false}` because the server already decided what matches,
    including on fields the label does not show (a user's email) -- client-side re-filtering would
    silently drop those hits.
  - In-flight requests are aborted when the query moves on: without it a slow response for "ab" can
    land after the response for "abcd" and repopulate the list with stale results.
  - _Fourth time the lint config was right this phase:_ the short-query branch cleared state
    synchronously inside the effect. Deriving the empty result instead is both simpler and one
    fewer render -- the effect now only ever starts work, never corrects state.
  - _Observations:_ verified against the container with real core-api data -- Ctrl+K opens with
    focus in the input, Escape closes, a one-character query asks for more, and searching
    "Frankenstein" finds the seeded instance group and navigates to `/en/groups/<id>`. That
    destination is still a placeholder page; the palette's job is to get there.

- **[2026-08-21 20:15] Review pass** (operator asked, after Phase 2 closed, whether anything done so
  far should be improved). Seven findings, all fixed. Two were missed brief requirements, four were
  real bugs, one was duplication I had introduced myself an hour earlier.
  - **No `LICENSE` file.** Brief §7: "Legacy is MIT. Ship a matching `LICENSE` and attribute the
    original project." Nothing existed, and the word appears in no doc -- the same category of
    oversight as F-027's missing Dependabot config. Added, MIT, attributing ReCodEx and naming the
    specific behaviours derived from reading the original implementation (upload protocol, markdown
    delimiter rules, extension→language map, evaluation state machine).
  - **The seed script could not run on a fresh database -- four separate bugs**, which matters
    because DEC-052's whole point was a one-command bootstrap on another machine, and this is the
    script that makes the instance usable.
    1. It hardcoded a python3 pipeline UUID, commented as "verified live against this deployment".
       That verification was genuine and the value was still wrong everywhere else: **core-api
       assigns pipeline ids when the runtime package is imported**, so every fresh database gets
       different ones. Now looked up by name and runtime environment.
    2. It treated "an exercise with this name exists" as "that exercise is usable". A run that dies
       partway leaves an exercise that matches by name and that core-api rejects as _broken_ on the
       next assignment attempt. Configuration steps now run for a reused exercise too.
    3. `POST /exercises/{id}/tests` **adds** rather than replaces, so re-running failed with "test
       name 'Test 1' is already taken". Now sends the existing test's id, turning it into an update.
    4. Exercise edits are guarded by optimistic concurrency and the payload hardcoded `version: 1`,
       which only works on an exercise nobody has touched. Now read back first.
       `docs/SEED_ACCOUNTS.md` claimed the script was "verified idempotent" -- it was, on the path
       where nothing had gone wrong before. It genuinely is now: two consecutive runs create nothing.
  - **The sidebar linked to routes that do not exist**, which is not a neutral omission: Next
    prefetches every visible `<Link>`, so `/groups/{id}` 404s were being logged on the _linking_
    page. Invisible on this instance until the seed data existed, because the superadmin belongs to
    no groups -- the smoke suite's console-error check caught it the moment students had groups.
    Added route skeletons for `/groups/:groupId`, `/exercises/:exerciseId` and `/users/:userId`,
    and registered the three dynamic breadcrumb resolvers `lib/breadcrumbs/manifest.ts` had been
    explicitly holding a place for ("add a `DynamicManifestEntry` here in whichever ticket builds
    that route for real"). Their response shapes are now confirmed, so this is no longer a guess.
  - **`getCurrentUser()` and `getMyGroups()` now memoize per request** via React's `cache()`.
    Deliberately _not_ in tension with "never cache user-scoped data": that rule is about a cache
    outliving the request and leaking across users, which `cache()` cannot do. Without it the shell
    and every page that also needs the current user would each issue their own call on every
    navigation, and the S-series screens will all want it.
  - **Duplication I had just introduced**: the command palette's search route carried its own copy
    of the `localizedTexts` lookup, an hour after `localizedName()` was extracted for exactly that.
    Now uses the shared helper. Also switched `app/api/auth/restricted-token/route.ts` to
    `readSessionToken()`, so all four routes that need a token without a redirect go through one
    function rather than three of them sharing it and one reading the cookie by hand.
  - _Observations:_ the full e2e suite now passes end to end -- **64 tests**, including
    `security.spec.ts`'s non-negotiable token-leakage checks and the whole authenticated smoke
    matrix, all of which had been failing for want of seed data. Before this pass they could not
    run at all on a fresh instance.

- **[2026-08-21 21:00] F-027 reverted; dependency review is now a process step, not a bot.**
  `.github/dependabot.yml` removed, `pnpm deps:check` added.
  - _What happened:_ the config added during the review pass reached GitHub and Dependabot ran
    **immediately against the default branch** rather than waiting for its schedule, opening three
    PRs (`actions/checkout` v4→v7, `actions/setup-node` v4→v7, one grouped npm update) against
    `main` while the operator's own work sat in a PR from `dev`. The grouping in that config is the
    only reason it was three PRs and not about ten.
  - _My error was not the config, it was not flagging it._ Adding that file is not a free
    documentation-style change: it takes an action the moment it lands. I treated a missed brief
    requirement as costless and enabled a robot on someone else's repository without saying so.
  - The operator asked for this to be part of the working process instead. `pnpm deps:check` runs
    `pnpm outdated` and `pnpm audit` together, on request. Brief §4's actual concern -- a Next.js
    security release going unnoticed -- is met by that plus GitHub's passive Dependabot _alerts_,
    which are a separate feature needing no config file and opening no PRs. Recorded as DEC-056
    with the trade-off stated: weaker latency, stronger control.
  - _The first run immediately found two things worth knowing:_ `next` is 16.3.1 here against
    16.3.2 released (the line brief §4 says to stay current on), and **typescript 7.0.2 and eslint
    10.9.0 have both shipped** -- which is exactly the condition F-002's TypeScript 6.0.3 pin was
    waiting on. Filed as F-028 rather than bumped mid-PR; the plugins need verifying first, since
    their lack of support was the reason for the pin.

- **[2026-08-22 15:45] S-001:** Dashboard, student section. `app/[locale]/(app)/dashboard/page.tsx`,
  `components/dashboard/{student-section,upcoming-deadlines,group-progress}.tsx`,
  `lib/api/dashboard.ts`, `lib/status/assignment-progress.ts` + unit tests,
  `components/status/assignment-progress-badge.tsx`, `Dashboard` strings in both locales,
  `e2e/dashboard.spec.ts`. **Phase 3 (Student Experience) is open.**
  - _The data was already being fetched._ `GET /v1/users/{id}/groups` returns a third key next to
    `student`/`supervisor`: a `stats` array with, per group, the caller's points, threshold and a
    per-assignment row (status, points, best solution). The app shell already calls this endpoint
    every render for the sidebar, so the entire "how am I doing" half of the dashboard costs zero
    additional requests -- `lib/api/groups.ts` now memoizes the _raw fetch_ rather than the
    locale-dependent projection of it, which is what lets two unrelated callers share one call.
    Only the deadlines needed more: one `/v1/groups/{id}/assignments` per group, because core-api
    has no assignment collection endpoint at all (the same gap Q-011 records for search).
  - _`/v1/users/{id}/groups` does not report group administrators_ -- and this is the finding that
    mattered most, because it was breaking already-shipped code. Its `supervisor` key is
    `User::getGroupsAsSupervisor()`, one membership type; a user who _administers_ a group appears
    in neither list. D-014's "My Teaching" sidebar section had therefore **never rendered on this
    instance** -- not for `sasha.mentor` (admin of Large Lecture, and the brief's own "one person,
    two audiences" persona), not for the superadmin (admin of all four seeded groups). An absent
    optional section looks exactly like a correct one, which is why nothing caught it. Fixed by
    unioning in every group from `/v1/groups` whose `privateData.admins` contains the caller, the
    same derivation the legacy app makes (DEC-058). I found this only because my own teacher slot
    was untestable: no persona could reach it.
  - _A `null` assignment status is ambiguous and I chose the understating reading._ core-api builds
    the best solution from _valid_ solutions only, so a student whose every submission failed
    infrastructurally has no status -- indistinguishable from one who never started. Visible right
    now: `alice.student` has four submitted solutions, all `Isolate init error` (DEC-031's cgroup
    v2 limitation), and the dashboard says "Not submitted" for both assignments. The legacy
    dashboard reads the same field and says the same thing. Recorded as Q-012 with the endpoint
    that would separate the two cases if it ever matters.
  - _Deadline filtering happens on the server, deadline **rendering** does not._ Which assignments
    are still open is decided once, server-side, and the client renders exactly that list -- no
    recomputation during hydration, and nothing here is cached to go stale. The badge that says
    whether a deadline has passed stays client-only (D-011's `DeadlineBadge`), because that one is
    a live comparison against _now_. `secondDeadline` arrives as `0` rather than `null` when unset
    (confirmed live), which without a guard produces a 1970 date and silently reports every such
    assignment as long closed.
  - _Two things the stats row cannot say_, both documented at the point of use rather than
    smoothed over: a compilation failure is indistinguishable from a wrong answer (`initFailed`
    lives on the evaluation, which stats omit), and the maximum shown is the before-first-deadline
    one even after that deadline passes. Both belong to the assignment's own screen (S-012/S-015),
    which has the real evaluation.
  - _Truncated at ten rows rather than paginated._ This is a landing pad; a student in four groups
    would otherwise open the app to sixty rows, and pagination controls would make the first screen
    of the product a table widget. `DataTable` is deliberately not used here for the same reason --
    sorting this by anything other than urgency defeats the panel.
  - _Two small fixes to shipped code, both found by needing them:_ `AppShell` had no `<main>`
    landmark at all (the page sat in a bare `<div>`, so nothing let a screen-reader user skip the
    sidebar, and a page heading was indistinguishable from the identically-named sidebar section);
    and `PageShell` marked _every_ unlinked crumb `aria-current="page"`, which became wrong the
    moment a breadcrumb chain contained a section with no page of its own. `/assignments` is the
    first such section -- IA §2 gives `/assignments/[id]` no index page -- so the manifest grew an
    `unlinked` flag rather than each page inventing its own answer (footgun #12).
  - _Observations:_ verified against the container with real core-api data, in both locales, in
    dark mode and at phone width. The student sees two open assignments ordered by deadline with
    their group, points and status; `sasha.mentor` sees the student half plus a teaching section
    that now exists; the superadmin sees the teaching half and no student half. **70 e2e tests
    pass** (64 before). The "no group memberships" empty state is the one branch no seeded persona
    can reach -- filed as F-029 rather than left as an untested claim.

- **[2026-08-22 16:30] S-002:** Dashboard, teacher section. `components/dashboard/{teacher-section,
review-queue}.tsx`, `getTeacherDashboard()` in `lib/api/dashboard.ts`, `/solutions/[solutionId]`
  route skeleton + breadcrumb resolver, review fixtures in `scripts/seed.ts`, `Dashboard.reviews`/
  `Dashboard.teaching` strings in both locales, four more tests in `e2e/dashboard.spec.ts`.
  - _The two queues are cheap and the third panel is the expensive one._
    `/v1/users/{id}/pending-reviews` and `/v1/users/{id}/review-requests` each answer
    `{solutions, assignments}` -- the assignments come _with_ the solutions, so neither needs a
    fan-out. Only the author names do: a solution carries `authorId` and nothing else about the
    person, so both queues' authors are resolved together in one batched
    `POST /v1/users/list`, the same endpoint the legacy dashboard uses for exactly this. The
    deadline panel is the one that fans out, one call per taught group, for the same reason S-001's
    does.
  - _The panels had no data, so the seed script grew two fixtures._ A review request and an open
    review are states no amount of submitting produces: one is a flag the _student_ sets
    (`set-flag/reviewRequest`, authorised by `canSetFlagAsStudent`), the other is a review a
    _teacher_ opened and did not close (`POST .../review` with `close: false`, which sets
    `reviewStartedAt` and leaves `reviewedAt` null -- exactly what `findPendingReviewsOfTeacher`
    looks for). Both are idempotent by reading the solution's current state first; both are now
    documented in `SEED_ACCOUNTS.md`. Building the UI first and discovering it renders nothing was
    the alternative.
  - _A 403 is treated as an empty queue, not an error._ Core-api grants `listPendingReviews` from
    the `supervisor-student` role upwards, and group membership is a separate axis from the global
    role -- so a group admin whose global role is `student` reaches this code and is refused. Same
    choice D-015's search route made: attempt it and let core-api decide, rather than
    reimplementing its rule here and drifting from it.
  - _"Sorted by waiting time" needed a timestamp core-api does not record._ There is no
    "requested at" field; a review request is a boolean flag on the solution. The queue sorts by
    the solution's `createdAt`, which is the honest lower bound on how long the student has been
    waiting, and the column says "Submitted" rather than pretending otherwise. Open reviews sort by
    `review.startedAt`, which is real.
  - _The third thing IA §4.1 asks for is not built, and that is a considered answer, not an
    omission._ "Recent activity -- new submissions, comments" has no endpoint behind it: core-api
    exposes solutions per assignment or per student-in-a-group, never "everything recent across the
    groups I teach". Assembling it would mean one request per assignment across every taught group
    -- 27 for the seeded superadmin, unbounded for a real teacher -- on the landing page, to
    discard most of the result. Recorded as Q-013; the legacy dashboard has no such feed either, so
    parity is intact.
  - _No inline "close review" button_, which the legacy list does have. Closing a review says "I
    have read this and I am done"; a control that does it from a summary row, without the reader
    having opened the solution, is a worse affordance than the navigation it saves. The capability
    moves to S-018's review screen rather than being dropped (DEC-059).
  - _One component now serves both halves' deadline tables._ S-001's `UpcomingDeadlines` grew an
    optional `stats` and an `empty` slot instead of being copied: a teacher planning around a
    deadline has no solution of their own, so the points and status columns simply are not there,
    and each caller passes its own empty state because "nothing is due" and "nothing in the groups
    you teach" are different sentences.
  - _Observations:_ verified in the rebuilt container against real core-api data. The superadmin
    sees both queues (Alice Student, in Intro to Programming), the ten nearest of 27 open
    assignments across four taught groups, and an honest "17 more open assignments are not shown".
    **73 e2e tests pass** (70 before). The smoke suite's dashboard screenshots now catch the
    streaming skeleton rather than the content, because the teacher half is behind its own
    `Suspense` boundary -- that is the boundary working, not a regression.

- **[2026-08-22 19:20] S-003:** Dashboard, calendar view -- and with it the `?tab=` deep-link the
  two previous tickets deferred. `components/dashboard/{calendar-section,deadline-calendar,
section-nav}.tsx`, `lib/format/calendar-month.ts` + unit tests, `getDeadlineCalendar()`,
  `Dashboard.calendar`/`studies`/`nav` strings in both locales, five more tests in
  `e2e/dashboard.spec.ts`. **The dashboard is complete.**
  - _The ticket's inventory row was pointing at a different feature._ S-003 was mapped to the
    legacy `userCalendars` module, which is not a calendar view: it manages **iCal subscription
    tokens**, it lives on the EditUser page, and the legacy app has no in-app calendar at all. Two
    capabilities, one row -- and marking S-003 done as "the `userCalendars` row" would have quietly
    buried the token manager, which is a real parity item. The month view is a new-design addition
    (`docs/IA.md` §2); the token manager is now recorded against S-022, where legacy renders it.
    Q-014. They are the same dataset by construction, incidentally: the iCal feed exports "deadline
    events for all assignments in all groups related to you", which is exactly what this calendar
    draws.
  - _Deep-linking to a section by scrolling does not work here, and I measured that rather than
    assuming it._ With each section behind its own `Suspense` boundary, both a `#fragment` and a
    scroll-on-mount effect land on the target and are then pushed back down as the sections above
    stream in -- a Playwright probe reported the calendar heading at the same `y=1026` with and
    without the fragment, i.e. neither had scrolled. So `?tab=` now renders the named section
    **first in the document**: a cold deep-link lands on what it asked for with no JavaScript,
    nothing to undo when the rest arrives, and nothing hidden, which is what §4.1's "no mode
    switch" asks for. The in-page nav is separately a set of plain `#fragment` links -- the one
    navigation a browser does instantly and correctly on an already-rendered page. The
    scroll-on-mount island written for the other approach was deleted rather than kept "just in
    case". DEC-060.
  - _Calendar arithmetic on `YYYY-MM-DD` strings, not `Date` objects._ Which day a deadline falls
    on depends on the time zone, and this app pins one rather than using the server's or the
    browser's. A `Date` carries an instant, not a calendar day, so every operation on one has to
    remember to convert -- and the first that forgets moves a midnight deadline to the wrong day,
    in the one place where being one day off is the entire point. Instants are converted to days
    once, in `getTimeZone()`'s zone (the same zone the formatter renders in, so the two cannot
    drift), and everything after that is string and integer work. `Date.UTC` appears only as a
    calendar calculator, never formatted, because UTC is the one zone where "add a day" is always
    24 hours.
  - _`Intl.Locale.prototype.getWeekInfo()` does not exist in this Node_ (22.22.3, checked rather
    than assumed), so the week starts on Monday in both locales -- correct for `cs` and for the
    `en` of a Czech university, and honest about being a decision rather than a hardcoded table
    pretending to be locale-awareness.
  - _"Today" is rendered on the server here, which contradicts nothing._ `DeadlineBadge` insists on
    client-side evaluation because it answers "has this deadline passed", against the reader's own
    moment, and they act on the answer. This highlight answers "which cell is today in the course's
    time zone", and **nothing recomputes it in the browser** -- so there is no second answer to
    disagree with the first, and no hydration mismatch to have. It goes stale on a page left open
    across midnight; a ring around the wrong square is cosmetic.
  - _Month navigation needs no client JavaScript at all._ The displayed month is `?month=YYYY-MM`,
    so previous/next are ordinary links to the same server-rendered page, and a particular month is
    shareable (brief §9). An unparseable value falls back to the current month rather than 404ing:
    there is no such thing as a month that does not exist, and a malformed month in a shared URL
    should still show a calendar.
  - _Two presentations, one dataset:_ the month grid from `sm` up, a plain list of the days that
    have deadlines below that. A seven-column grid on a phone is either unreadably small or
    horizontally scrolled, and neither is a calendar anyone reads. `display: none` keeps only one
    in the accessibility tree.
  - _A side effect worth having:_ `fetchGroupAssignments` is now memoized per request, so the three
    sections -- which between them ask about the groups the reader studies in, teaches, and both --
    fetch each group's assignments once rather than up to twice.
  - _Observations:_ verified in the container, both locales, dark mode, desktop and phone. The
    student sees August with today ringed and the 4 September deadline in the trailing week (the
    grid fetches the whole displayed range, not the month); the superadmin's September shows a
    deadline on nearly every day across four taught groups. **78 e2e tests pass** (73 before).
    Second-deadline entries render in a distinct tone but are **not visually verified**: no seeded
    assignment sets `allowSecondDeadline`, so that branch has never had real data behind it.

- **[2026-08-22 20:40] S-004 + S-011:** Group list and archive.
  `app/[locale]/(app)/{groups,archive}/page.tsx`, `components/groups/group-table.tsx`,
  `getGroupList()`, `e2e/groups.spec.ts`.
  - _One table, not "mine" plus "discover"._ core-api already decides what a reader can see -- for
    a student their own groups plus the ancestors above them, for an administrator the instance --
    so two lists would have shown the same row twice. A membership column answers the same question
    without the duplication.
  - _The first real `DataTable` use immediately found a bug in D-003:_ its own chrome (pagination,
    the select-all label, the empty text) was hardcoded English. Nothing caught it while the only
    caller was the design-system showcase; a Czech reader would have seen it here. Now a `Table`
    namespace read through `useTranslations`, which works because `NextIntlClientProvider` wraps
    the app.
  - _Ancestry as a path above each name_ rather than a tree widget, resolved from the same response
    -- core-api returns the ancestors it walked through, so the map is already complete, and an
    ancestor the reader genuinely cannot see is absent rather than shown as an id.
  - _Client-side sort/filter/page over one response_, with the point at which that stops being
    right (an instance with thousands of groups, where core-api offers `search` but **no** paging
    on this endpoint -- checked) recorded as Q-015 rather than pre-solved.
  - _No unarchive action_ on the archive: it is a mutation, and it belongs with the rest of group
    administration in S-009 rather than being the one write on a read-only screen.
  - _Observations:_ the "organizational" badge has no data behind it -- no seeded group is
    organizational, including the instance root, which is merely public. Folded into F-029 with the
    other two unreachable states rather than left as an untested claim.

- **[2026-08-22 21:00] S-005 + S-010:** Group detail, Info tab, and the hierarchy.
  `app/[locale]/(app)/groups/[groupId]/page.tsx`, `components/groups/{group-info,group-tabs}.tsx`,
  `lib/api/group-detail.ts`.
  - _Member names come from `POST /v1/users/list`, not `GET /v1/groups/{id}/members`._ That
    endpoint returns ready-made user objects and is the obvious choice, but core-api marks it
    `@deprecated` ("Members are listed in group view") **and** it omits observers -- the endpoint
    being retired is also the one that answers less. One batched lookup over the id arrays already
    in the group view covers all three roles.
  - _Tabs are links to `?tab=`_, per IA §4.2's "no page reload... Server Component re-render with
    different search params". A tab appears only when `permissionHints` allows it _and_ the screen
    exists, so nothing advertises S-008/S-009 before they are built. An unknown `?tab=` falls back
    to Info rather than 404ing -- it is a view of a resource that does exist.
  - _The hierarchy needed no tree widget (S-010)._ Ancestors are the page subtitle and a parent
    link, children a subgroup list; both directions are ordinary links, which are keyboard- and
    screen-reader-navigable for free, where a custom tree is not. Ancestor names are fetched per
    group rather than read off the group list, because an ancestor can be a group the reader is not
    a member of -- and `fetchGroup` is memoized, so one shown twice costs one call.

- **[2026-08-22 21:20] S-006 + S-007:** The group's assignments and students tabs.
  `components/groups/{assignment-table,assignment-filter,student-table}.tsx`,
  `getGroupAssignments()`, `getGroupStudents()`.
  - _The filter is server-side and in the URL._ Each option is a real address, needs no
    JavaScript, and the back button steps through the reader's choices; no row they filtered out is
    shipped to the browser.
  - _The personal columns are conditional on being a student here_, not on a role: a supervisor has
    no solution of their own, and "0/10, not submitted" against their name would be a claim about
    someone nobody asked to submit. Same `stats === null` signal the dashboard uses.
  - _`DateTime` could not come along._ It is a Server Component and a `DataTable` cell renders in
    the browser, so D-012's formatting options moved into a shared module both sides import. Same
    options, same formatter, same pinned zone -- which is what keeps "one date format" true across
    that boundary instead of a second set of literals drifting quietly.
  - _The roster sorts by name, not by points._ A roster that opens ranked is a leaderboard, which
    is a different thing to hand a teacher by default -- and ReCodEx itself treats "students see
    each other's progress" as a per-course decision. The per-student x per-assignment matrix is
    T-006's screen; `students/stats` already returns every cell of it, so that ticket needs no new
    endpoint.
  - _Observations:_ verified against the container for a student and for the superadmin, including
    that a student of this group sees the Students tab at all -- `permissionHints.viewStudents` is
    true because the group has `publicStats` set, which is core-api's decision to make, not this
    app's. **92 e2e tests pass** (78 before).

- **[2026-08-22 22:10] S-012:** Assignment detail, student view.
  `app/[locale]/(app)/assignments/[assignmentId]/page.tsx`,
  `components/assignments/assignment-detail.tsx`, `lib/api/assignment.ts`,
  `e2e/assignments.spec.ts`. The destination every deadline row has linked to since S-001 is now a
  real screen.
  - _The reader-facing text is `text`, not `description`_ -- worth stating because getting it
    wrong would have produced an empty page for exactly the people the screen is for, and only for
    them. In core-api's `LocalizedExercise`, `text` is the assignment as written for whoever solves
    it and `description` is the author's internal note; the view factory strips `description` for
    anyone without `viewDescription`, which `permissions.neon` grants from `supervisor-student`
    upward and never to a plain `student`. Confirmed on a live response as the seeded student.
  - _Whether submitting is possible is core-api's answer, in words, with no button behind it._
    `/can-submit` folds in the deadline, the attempt limit, the group's licence, exam locks and a
    system-wide submission lock -- reimplementing any of that here would drift. The action is
    S-014's, and a button that led nowhere would be worse than the sentence.
  - _The attempt counter reports **evaluated** solutions, not submitted ones_, because that is what
    core-api counts against the limit (`findValidSolutions`). A submission that died in the
    pipeline does not consume an attempt, and saying otherwise would cost a student one -- visible
    right now on the seeded data, which reads "You can submit — 20 attempts left. 0 evaluated, 2
    failed to evaluate."
  - _This screen tells the truth the dashboard cannot._ Both of the seeded student's solutions show
    **Evaluation failed** here, where the dashboard says "Not submitted" for the same two -- not an
    inconsistency but Q-012 exactly: this page has the solutions and their `lastSubmission`, the
    dashboard has only a stats row core-api builds from _valid_ solutions. Same helper family
    (`evaluationStatus` here, `assignmentProgress` there), different fidelity of input.
  - _Observations:_ verified against the container as the student and as the superadmin (who sees
    the same screen and an honest "Nothing submitted yet" rather than a personal claim). **96 e2e
    tests pass.**

- **[2026-08-22 22:50] F-029:** Seed fixtures for the three UI states nothing could reach --
  `seed.newcomer` (no memberships), `[seed] Faculty of Seeded Studies` (organizational), and a
  third Intro to Programming assignment with a **second deadline** (10 points before, 5 after).
  Each had been found by building the screen that renders it and having nothing to render.
  - _And a real idempotency leak, found by re-running the seed four times:_ the exercise's
    reference solution was submitted unconditionally. Every other write in
    `getOrCreateBaseExercise` replaces; that one appends, and **eight** reference solutions had
    accumulated before anyone looked. Guarded now by its own `[seed]` note. The existing extras
    were left alone -- deleting instance data is an operator's call.

- **[2026-08-22 23:30] S-014:** Submitting a solution -- the brief's own "highest-value screen in
  the app", and this repo's first real Server Action.
  `app/[locale]/(app)/assignments/[assignmentId]/submit/page.tsx`,
  `components/assignments/submit-form.tsx`, `lib/actions/submit-solution.{ts,schema.ts}`.
  - _Three steps, in the order core-api imposes them._ Files upload first through D-005's chunked
    Route Handler and **never** through the action (a Server Action's body limit is ~1 MB and
    solutions are archives -- AGENTS.md footgun 7); `pre-submit` runs once the files exist, because
    the environments it offers are derived from the _file names_; then submit posts note, file ids
    and environment. Nothing re-implements `canSubmit`: the deadline, attempt limit, group licence,
    exam locks and a system-wide lock are all core-api's, re-checked on the real submit regardless.
  - _A page, not the legacy modal (DEC-061)._ An upload that takes real time should not be one
    stray click on a backdrop away from being lost, and D-004's dirty guard cannot intercept in-app
    navigation anyway (its own doc records why).
  - _Two seed bugs surfaced, both invisible until something used the real path._ The exercise's
    environment config declared no `source-files` variable, so
    `ExerciseConfigHelper::getEnvironmentsForFiles()` matched nothing and `pre-submit` answered
    `environments: []` for a perfectly good `solution.py` -- the seed's own submissions never
    noticed, because they pass `runtimeEnvironmentId` directly and skip pre-submit entirely. And an
    assignment is a _snapshot_ of its exercise, so fixing the exercise left all 28 existing
    assignments on the old copy; the script now re-syncs any that report stale, which is every run,
    since the exercise is deliberately rewritten each time.
  - _Two smaller things, each found by needing it:_ `FileUpload` advertised the 512 MiB deployment
    ceiling even where the assignment's own limit is 64 KiB, so it now takes the consumer's number
    (display only -- enforcement stays where it was); and RHF's `setValue` writes straight to the
    DOM, so preselecting the single detected language in the same tick as rendering its `<option>`
    silently discarded the value. It runs after that render now, which is what the effect is for --
    found live, with python3 sitting visibly below a select reading "Choose a language".
  - _Observations:_ the e2e suite uploads a real file through the real chunked path and lands on
    the created solution. Note that each run creates a genuine solution on the instance; on this
    box they fail evaluation and so do not consume an attempt, which would not hold on a working
    host.

- **[2026-08-23 00:10] S-015:** The solution screen -- where submitting lands and where every
  "Attempt N" link goes. `app/[locale]/(app)/solutions/[solutionId]/page.tsx`,
  `components/solutions/evaluation-results.tsx`, `lib/api/solution.ts`.
  - _One request carries the evaluation._ core-api's solution view embeds the last submission in
    full, test results included, so the test-by-test table needs no second call.
  - _Four outcomes, treated as different things rather than degrees of one._ An infrastructure
    failure says plainly that the reader is not at fault and shows core-api's own description; "not
    evaluated yet" is its own state (S-016 makes it update itself); a failed _initiation_ puts the
    compiler output front and centre rather than behind a disclosure, because it is the whole
    answer; only the fourth is a test table.
  - _Every column is conditional on the data arriving, not on a role check._
    `TestResult::getDataForView()` nulls measured values, limit ratios and each judge log
    independently per assignment flag, so a null means "not for you" and the column is not rendered
    at all.
  - **_What this ticket could not verify, stated plainly:_** no solution on this machine has a real
    evaluation, so the test table, the compilation-output panel and the limit-exceeded badges have
    never been seen with data. The failure path is the one that _can_ be tested here -- and is,
    against the real "Isolate init error" every seeded submission produces. This is DEC-031's cost
    landing on the screen it was always going to land on; re-verify on a cgroup v1 host before
    trusting the rest.

- **[2026-08-23 01:30] S-017:** The solution's source code, at `/solutions/:id/sources` --
  `app/[locale]/(app)/solutions/[solutionId]/sources/page.tsx`,
  `components/solutions/source-file.tsx`, `lib/api/solution-files.ts`,
  `app/api/solutions/[solutionId]/download/route.ts`.
  - _Its own route, not `docs/IA.md` §4.4's second column (DEC-062)._ §2 already gives sources an
    address; the evaluation answers "what happened" and the sources answer "what did I write, and
    what did my teacher say about it". They are read at different moments, each is long, and only
    one of them is worth sending someone a link to a specific line of.
  - _D-009's viewer had to be taken apart to make S-018 possible (DEC-063)._ It rendered Shiki's
    HTML string through `dangerouslySetInnerHTML`, and there is no way to put a comment thread
    between two lines of a string. It emits `codeToTokens` output now -- the same colouring as
    plain data, which crosses the RSC boundary without a grammar, a theme or a highlighter
    following it, and which React escapes token by token. **The annotated variant is a `<div>`,
    not a `<pre>`**: `<pre>`'s content model is phrasing content, so the comment form inside one
    is markup the parser is free to relocate -- a hydration mismatch, not a warning.
  - _A bug that only exists once a page has two files: every line claimed `#L1`._ D-009 gave each
    line `id="L{n}"`, which is right for one file per page and silently wrong for eight. Anchors
    are prefixed per file now (`main-c-L12`), derived from the file's name rather than its index
    so a link keeps pointing at the same file when another one is added.
  - _ZIP entries are files, not archives._ core-api attaches `zipEntries` to an archive rather
    than its contents, and the legacy app expands them into first-class rows
    (`archive.zip#src/main.c`) -- which matters beyond display, because that string is the key a
    review comment stores in its `file` field. Same expansion, same names, same dropped directory
    records here. The legacy display ceiling came along too: at most 32 files totalling under
    1 MiB, and past that the page offers the archive instead of tokenising a hundred files nobody
    asked to read.
  - _The archive download is a Route Handler, for D-005's reason inverted._ The response is a ZIP,
    and `lib/api/client.ts` exists to unwrap a JSON envelope -- it would reject the bytes. The
    handler reads the token from the cookie, streams `response.body` straight through without
    buffering it, and the link the page renders points at this app, never at core-api with a
    token attached.
  - _The ZIP path had no fixture, so the seed grew one (F-029's pattern again)._ Nothing on this
    instance had ever been submitted as an archive, which meant the expansion above would have
    shipped unverified. `scripts/seed.ts` now submits a real `solution.zip` (`main.py` +
    `greeting.py`) -- built by a small stored-entry ZIP writer rather than by shelling out to
    `zip(1)`, which this script may not have. Verified live afterwards: both entries render as
    their own files, with their own anchors (`solution-zip-main-py-L2`), and the file navigation
    appears because there is finally more than one file. It also confirmed the anchor bug above
    was real and is fixed.
  - _One Playwright lesson worth keeping:_ `locator.evaluateAll()` does **not** auto-wait, and
    `page.goto()` resolves while the route's `loading.tsx` skeleton is still on screen -- so a
    helper that collected links that way read zero of them from a page full of them. It passed
    against `next dev` and failed against the production build, which streams differently. The
    spec waits for a real heading before reading.
  - **_What this still could not verify:_** `tooLarge` (a file past core-api's preview limit) and
    `malformedCharacters` (a non-UTF-8 file). Both notices are wired to core-api's own flags on
    the content response; neither has rendered with data.
  - _Observations:_ **105 e2e tests pass** (96 before), twice in a row against a production build,
    including the archive fixture and the two-context review round trip.

- **[2026-08-23 02:20] S-018:** Reviewing a solution, in the code, line by line.
  `components/solutions/{reviewable-code,review-comment,review-controls,review-summary}.tsx`,
  `lib/actions/solution-review.ts`, `lib/api/solution-review.ts`.
  - **_The rule worth building the whole ticket around: a review is invisible to its author until
    it is closed_** (DEC-064). core-api's `canViewReview` is true for the author from the moment a
    review exists -- the legacy app shows them nothing until `closedAt` is set. That is a product
    rule, not an oversight: closing is what counts the issues and emails the author, and a
    half-written review is not a verdict. This is the one place in this app that deliberately
    shows _less_ than the API would allow, which is why it is written down twice. **Verified with
    two browser contexts in one test**: the supervisor writes a comment, the student reloads and
    sees nothing, the supervisor closes the review, the student reloads and sees it -- asserting
    it from the reviewer's own session would have proved nothing.
  - _Comments can only be added to a review that has been opened_, as in the legacy app. core-api
    will happily open one implicitly on the first comment; requiring the deliberate act keeps
    "start a review" from being a side effect of typing, and it is what makes the open/closed
    state mean anything to the student.
  - _A per-line button, and the legacy double-click as well._ The legacy viewer's only way to
    start a comment is double-clicking a line -- a gesture no keyboard can perform, on the screen
    where a teacher does most of their work. The gutter button is what makes it reachable; the
    double-click is kept because it is what the people migrating already do.
  - _Who may edit which comment is two questions._ `permissionHints.addReviewComment` says whether
    this reader may write at all; the legacy `restrictCommentAuthor` rule says a supervisor edits
    only their own comments while a group's primary admin edits any. The second needs the group's
    `primaryAdminsIds`, which `getSolutionDetail()` already had the group response to read. Both
    are offers, not authorisation -- core-api re-checks every write.
  - _No `revalidatePath` anywhere in the actions._ Every read goes through the API client, which
    is `cache: "no-store"` unconditionally (DEC-021), so there is no cached entry to invalidate;
    the client refreshes the router and the Server Component fetches the review again. Worth
    stating because the reflex in a Next codebase is to add it, and here it would be cargo.
  - **_What this could not verify:_** closing or editing a closed review sends the author an email,
    and this deployment has no outbound SMTP (Q-007/ASS-008). The `suppressNotification` checkbox
    is wired to core-api's own flag and only offered while the review is closed -- the only state
    in which it does anything -- but no message was ever observed leaving.

- **[2026-08-23 03:00] S-016:** Live evaluation progress -- and DEF-004 closed, with "both"
  (DEC-065). `components/solutions/evaluation-progress.tsx`.
  - _The monitor's channel id is disclosed once, and never again._ It comes back in the response to
    the submit that created the job; no endpoint returns it later. That single fact decides the
    design: a WebSocket cannot be the mechanism for a solution page opened at any other moment,
    which is most of them. So the page **refreshes itself** on a five-second timer -- `router.refresh()`,
    which re-runs the server render, so the result is rendered once, on the server, by the code
    that already renders it, rather than by a second client-side copy of the test table that could
    disagree with it. Stopped when the tab is hidden and after five minutes.
  - _The socket is layered on top where the id exists._ `submitSolution()` now returns it and the
    submit form carries it to `/solutions/:id?monitor=...&tasks=...`; the island connects
    **directly to the monitor**, bypassing the BFF exactly as the legacy app does (it is
    unauthenticated by design and its messages carry only task states, no solution data).
  - _Protocol confirmed against a live job, not from documentation:_ the client sends the channel
    id as the first message, then receives `{"command":"DOWNLOADED"}`, `{"command":"STARTED"}`, one
    `{"command":"TASK", "task_state":"COMPLETED"}` per task, and finally `FAILED` or `FINISHED`.
    The monitor **replays** a channel's messages for five minutes, so connecting a moment late
    loses nothing -- which is what makes this work at all, given the page load sits between the
    submit and the connection.
  - _The socket's address comes from this deployment's config, not from the response that named
    the channel._ core-api returns `monitorUrl: ws://recodex.local/ws`; inside the container that
    is the same value `MONITOR_WS_URL` holds (both are built from `APP_DOMAIN`), and on a bare-host
    dev machine it is not -- the browser reaches this stack on `localhost`, and `recodex.local`
    resolves nowhere. Either way the island uses the env value passed in from the server: a socket
    destination that arrives in a response body, let alone in the page's own query string, is one
    this app did not choose.
  - _Verified live, in pieces, because the whole cannot be:_ the socket against a real job's
    channel (3 of 6 tasks counted, the bar red because the job genuinely failed), and the
    self-refresh by watching a server-rendered timestamp change twice in twelve seconds. **What
    could not be reproduced end to end is the state itself**: on this host every evaluation fails
    in well under a second (DEC-031), so the pending window the island is built for is never open
    long enough to photograph -- and stopping the worker produces an immediate broker failure
    ("Worker ... dieded") rather than a queued job. Re-verify on a host with a working sandbox.

- **[2026-08-29 12:40] S-013:** The assignment screen, as the person who set it reads it.
  `components/assignments/{class-progress,solver-table,exercise-sync-notice,solution-list}.tsx`,
  `lib/api/assignment-solvers.ts`,
  `app/[locale]/(app)/assignments/[assignmentId]/users/[userId]/page.tsx`.
  - _Two of `docs/IA.md` §4.3's three teacher additions are links to screens nobody has built
    (DEC-066)._ "All submissions" is T-003 and "edit assignment" is T-002; a button to a 404 is
    worse than no button, so this ticket ships the third one in full and each of those tickets
    adds its own link here when it lands (noted on both rows in `BACKLOG.md`). What shipped is
    everything this page can answer by itself: the class summary, the roster, the teacher-only
    terms, and the state of the assignment's relationship with the exercise behind it.
  - _The summary reads three cheap responses, and deliberately not the solutions list (DEC-067)._
    `/v1/assignment-solvers?assignmentId=` says who attempted and how often,
    `/v1/groups/{id}/students/stats` carries core-api's own points for each student's best
    solution, and `/v1/users/list` puts names on both. `/v1/exercise-assignments/{id}/solutions`
    would answer the same and drag every attempt by everyone along with it -- T-003's payload on
    a page that displays none of it. **The roster comes from the stats response, not from the
    solver list**: a solver record outlives its owner's membership, so rows built from solvers
    would list leavers as students and omit everyone who has not started -- who are the half a
    teacher opens this for.
  - **_A number the dashboard has been getting wrong since S-001, fixed here because this view has
    the missing fact (DEC-068)._** Q-012 records that a `null` best-solution status cannot
    distinguish "never started" from "every attempt died in the pipeline", and that the dashboard
    resolves it to `not-submitted`. `lastAttemptIndex` settles it: the seeded student, whose
    eleven attempts all fail on this host (DEC-031), read as **"Not submitted"** in the first
    version of this table and reads as **"Evaluation failed"** now.
  - _Whatever speaks in the first person is now gated on studying in the group._ core-api answers
    `canSubmit: true` for a supervisor too, but the legacy app offers the button to students only,
    and "you have 20 attempts left" under an assignment you set is a claim about a submission
    nobody expects. Verified live: the supervisor's page has no "Submitting" and no "My
    solutions"; the student's is unchanged.
  - _`visibleFrom` is stated beside `isPublic`, not folded into it._ Whether a release date has
    passed depends on the current time, which a Server Component has no business deciding -- the
    rule `DeadlineBadge` exists for (AGENTS.md §6.6). The row reads "Hidden · visible from 18. 9. 2026" rather than computing a verdict on the server.
  - _The stale-sync notice is read-only, and that is not an omission._ An assignment is a snapshot
    of its exercise; core-api reports the drift per part and the legacy app offers "update texts"
    / "update configuration" buttons beside it. Re-syncing rewrites the assignment, which is an
    edit, and edits are T-002's -- which now owns that action explicitly. Part names carry the
    legacy app's own labels (`getSyncMessages`), with an unknown part rendering as its raw key
    rather than being dropped.
  - _Three states had no fixture, so they were produced against the live instance and then undone._
    Hidden + `visibleFrom`, and a genuinely stale assignment (edited the seed exercise, watched
    `localizedTexts.upToDate` go false, screenshotted the notice with real data, restored the text
    and re-ran `pnpm seed`, which reports 28 assignments re-synced). Cheaper than growing the seed
    for states no other screen needs, and it left the instance where it started.
  - **_Two findings worth more than the ticket._** `forbidden()` renders the right page and answers
    **HTTP 200** -- measured with a probe route whose whole body was that call, so it is the app
    shell streaming before any page body runs, not a late call (DEC-069, Q-016). And a core-api
    403 currently reaches the reader as "Something went wrong" from the error boundary: seen live
    when a student opened the assignment while it was hidden. That one is F-030, and it is the
    piece worth doing first.
  - _Observations:_ **108 e2e tests pass** (105 before: four new, one rewritten), including a
    student being refused another student's attempts. The 25-student group renders in ~330 ms with
    `DataTable`'s own pagination, 20 rows to a page.

- **[2026-08-29 18:15] F-030:** A refusal is not an error. `lib/api/read.ts`.
  - _One place, because there is only one boundary worth putting it at (DEC-070)._ `apiRead` (a
    GET) and `pageRead` (a read that is already a promise) turn core-api's 403 into `forbidden()`
    and its 404 into `notFound()`, and rethrow every other status as the `ApiError` it always was.
    `lib/api/client.ts` is untouched: it stays the transport that throws for everyone. The whole
    DAL and `lib/breadcrumbs/manifest.ts` read through the new module; **Route Handlers and Server
    Actions deliberately do not** -- an interrupt raised inside a JSON endpoint is not an answer
    its caller can read, and inside a Server Action it is eaten by the `catch` that builds the form
    error, which would leave a submitter with no page and no message.
  - _Three reads keep the raw client, and that is the whole subtlety of this ticket._ A
    `try`/`catch` around an interrupt suppresses it -- Next's own docs say so, and each of these
    three already catches: the dashboard's review queue (a 403 there means an empty queue, the
    existing behaviour a group admin with a student's global role depends on), a group's ancestors
    (an ancestor this reader cannot see is a missing crumb, not a missing page), and one file's
    content on the sources page (one unreadable file must not cost the reader the other
    thirty-one). Each carries a one-line comment saying why it is not `apiRead`.
  - _Verified live as a student, both halves, against the running stack:_ an assignment in a group
    she is not in now renders **Forbidden** ("You don't have permission to access this resource.")
    and a well-formed id matching nothing renders **Page not found**. Both said "Something went
    wrong" an hour ago. The 403 case is the exact one S-013 hit and could not fix in its own
    ticket.
  - _What this does not change._ The status code is still 200 (DEC-069, Q-016 -- the `(app)` shell
    streams before any page body runs). This ticket changes what the reader is told, not what the
    wire says, and those turn out to be separable.
  - _One neighbour found and left alone, as F-031._ core-api answers **401** (`401-002`) once a
    session outlives its token, and that still reaches the reader as the error page. It is not the
    same fix: the honest response is re-authentication, and a render cannot clear a cookie --
    `proxy.ts` sends anyone holding a session cookie back to `/dashboard`, so redirecting a stale
    one to `/login` would loop. It belongs next to `maybeRefreshSession()`, not here.
  - _Observations:_ **110 e2e tests pass** (108 before; `e2e/refusals.spec.ts` adds both cases,
    finding the 403 URL the way a reader would come by one -- from a teacher who can open it),
    39 unit tests pass, `typecheck`/`lint`/`build` green.

- **[2026-08-29 18:45] S-008:** The group's exams, from scheduling one to reading who sat it.
  `components/groups/exam-{status,form,table,roster,locks}.tsx`, `lib/api/group-exams.ts`,
  `lib/actions/group-exam.ts`, `lib/status/exam.ts`.
  - _The tab appears on the legacy app's own rule, which is not a role check._ Whoever may set an
    exam period sees it; so does anyone in a group that has held one or has one coming, because a
    student needs this tab to lock themselves in and needs it only then. `?tab=exams`, with one
    exam's records at `&exam=<id>` (DEC-071) -- the legacy app's second route renders the same
    screen with one row expanded, which is a selection, not a page.
  - **_The phase is computed twice, on purpose (DEC-072)._** The server decides it once, from its
    own clock, because it decides what the tab _fetches_: the roster is worth a request only while
    an exam runs, the lock records only after one ends. The status panel then ticks once a second
    in the browser, exactly as the legacy page does, and **refreshes the route when its answer
    stops matching what the server rendered** -- so a page open across the moment an exam begins
    becomes the exam page instead of quietly lying. The phase _text_ renders after mount only
    (`useSyncExternalStore`, `DeadlineBadge`'s shape); a phase printed on the server and reprinted
    a second later in the browser is AGENTS.md §6.6's mismatch, and this screen is nothing but
    time-dependent state.
  - _What core-api refuses, the form does not offer._ Once an exam has begun, its beginning and its
    lock type are fixed (`actionSetExamPeriod` rejects both), so those fields are disabled with the
    reason stated rather than submitted and rejected. "Start now" appears only while the scheduled
    end is under a day away, because an exam is capped at 24 hours from its beginning -- starting a
    distant one now would be refused. Lock records are offered only to a reader holding
    `viewExamLocks`, and never while an exam is still running.
  - **_An exam exists only because somebody sat it._** core-api creates the `GroupExam` record in
    `actionLockStudent` -- at the **first student lock**, not when the period is set. That single
    fact explains the empty state ("no exams recorded", not "none held"), why a cancelled exam
    leaves no trace, and why the seed fixture is the real sequence compressed (DEC-073): open a
    minute-wide period, have the seeded student lock in, end it. Idempotent, and wider than the
    sequence so a crash mid-way unsecures the group by itself instead of leaving it in exam mode.
  - **_The IP half of an exam lock records infrastructure, not the student (Q-017)._** core-api
    pins the lock to the address the request came from, and that request is made by this app's
    server. **Not a regression from the BFF**: this deployment's core-api trusts no proxy (no
    `http: proxy:` in the api repo's `config.neon`, checked), so the legacy frontend records the
    nginx container's address for every student just as we record ours. The `groupLock` half --
    which is what "secured mode" actually means -- works exactly as intended. The UI is worded to
    match: the student is told this group is the only one they can submit in, not that they are
    tied to this machine, and the teacher's column says "address recorded".
  - _Verified live, end to end, as three people._ The teacher scheduled an exam, started it, watched
    the roster, ended it; the student saw "exam in progress", locked in, and was told what they may
    still reach; the teacher then saw them move from "not locked in yet" to "locked in", unlocked
    them, and read the lock records afterwards. The run also produced the two states nothing else
    could: a recorded exam, and a lock record with a real timestamp and address.
  - _Observations:_ **113 e2e tests pass** (110 before: scheduling and cancelling a real exam, the
    seeded held exam and its records, and a student's view of the same tab), 49 unit tests (four
    new for the `h:mm` round trip and the phase boundaries). The mutating e2e test runs against a
    different group from the read-only ones, and cancels any exam a previous failed run left behind
    -- group-wide state is the one thing two Playwright workers can genuinely fight over.
  - _Inventory correction found on the way:_ the Info/Assignments/Students rows still read `todo`
    with route names (`/groups/[id]/info`) that S-005..S-007 never built; they ship as `?tab=`
    views and are marked accordingly now, alongside the two exam rows.

- **[2026-08-29 19:10] S-009:** The group's settings, and who belongs to it.
  `components/groups/{settings-form,settings-controls,member-manager,user-picker}.tsx`,
  `lib/actions/group-settings.ts`.
  - _One tab, two legacy screens, and one deliberate omission (DEC-074)._ Everything the legacy
    Edit Group screen does is here; so is the membership management the legacy app keeps on two
    _other_ screens (supervisors on group info, students on group students), because `docs/IA.md`
    §4.2 says Settings is where both belong and they are the same question about two kinds of
    person. **Invitations are not**: T-018 already owns them and S-023 owns the page an invitation
    link opens, so building the manager here would ship a link to a route nobody has written --
    DEC-066's rule, applied to someone else's ticket this time. Both rows say so now.
  - _An archived group renders no form at all._ It is immutable, so a form that submitted would be
    refused; the legacy screen hides it for the same reason. What is still offered is the way back,
    which is **the unarchive action S-011 deliberately left to this ticket** -- and, beside it, the
    **exam-group flag S-008 left here**, next to the organizational one, each hidden while the other
    holds because core-api forbids a group being both.
  - **_A blank name deletes that language rather than failing validation (DEC-075)._** core-api
    replaces the whole `localizedTexts` array with whatever it is sent, so the form has to submit
    every locale at once; given that, an empty field can only mean "this group has no text in that
    language". Most seeded groups are named in English only, and demanding a Czech name before an
    English one could be saved would be this form inventing a rule the API does not have. One name
    has to survive, and that is the rule the schema does enforce.
  - **_A bug in D-015, found because this screen made it undeniable (DEC-076)._** core-api's user
    list takes its search term as **`filters[search]`** and **silently ignores a bare `search`**,
    answering with every user it would have returned anyway. The command palette has been listing
    arbitrary users since D-015 -- plausible-looking output, which is exactly why it survived. A
    member picker that ignores what you type is not plausible-looking, it is broken, so this
    surfaced within a minute of first use. Fixed in `app/api/search/route.ts`; `/groups` and
    `/exercises` do take the bare parameter, re-checked live rather than assumed.
  - _Verified live as the administrator, every action and its undo:_ saving settings and putting
    them back; marking a group as an exam group and unmarking it -- **including watching core-api
    refuse the flag on a group that has subgroups**, which arrives as the toast's own message
    rather than as a broken page; archiving and unarchiving the seeded archived course; moving a
    throwaway group under another parent and then deleting it, which lands on the parent; adding a
    student and removing them; changing a supervisor's role and changing it back. The instance was
    left exactly as it was found.
  - _Observations:_ **116 e2e tests pass** (113 before), 49 unit tests. The two mutating e2e tests
    are self-healing -- each undoes its own change, and repairs the state a previously failed run
    would have left, because this suite shares one seeded instance with every other spec.

- **[2026-08-29 19:25] S-019:** What a detection tool reported about a solution.
  `app/[locale]/(app)/solutions/[solutionId]/plagiarisms/page.tsx`,
  `components/solutions/marked-source.tsx`, `lib/api/plagiarism.ts`.
  - _The screen reports; it does not accuse._ ReCodEx detects nothing itself -- an external tool
    runs elsewhere and **uploads** what it found -- so the page names the tool, says when its
    upload finished, and says the sentence in as many words. Everything on it is somebody else's
    claim, and reading it that way is the whole design.
  - _Only a teacher is ever told a report exists._ `viewDetectedPlagiarisms` is granted from
    `supervisor-student` upwards on an observed group, and core-api **omits the solution's batch
    field entirely** for anyone else -- so the author of a flagged solution sees no badge in their
    own list of attempts, no link on their own solution, and the Forbidden page if they guess the
    URL. All three verified live, as the teacher and as the student.
  - **_Matched passages are character ranges, so `CodeViewer` is the wrong tool (DEC-077)._** A
    detection tool reports pairs of `{offset, length}` _into the file_; D-009's viewer highlights
    whole lines, which would widen "these 24 characters matched" into "these three lines matched"
    on the one screen where the exact extent is the point. `MarkedSource` renders the file verbatim
    with `<mark>` on the reported ranges, merging overlaps first -- two fragments sharing a passage
    would otherwise nest into a darker patch that means nothing. Six unit tests cover the merge.
  - _The other side is fetched only when core-api says this reader may open it._ A supervisor of
    one group can be shown a match against a solution submitted somewhere they have no standing;
    the report still says so, names what it can, and leaves the source out rather than 403-ing the
    page around it.
  - **_The fixture is the upload (DEC-078)._** There is no way to reach this screen with data
    except for a tool to have uploaded some, so the seed performs exactly that upload: a second
    seeded student (Bob Classmate), a near-identical solution, a batch, one similarity, and
    `uploadCompleted`. The fragment offsets are computed from the two sources rather than written
    down. It is idempotent on the batch existing, because **nothing can delete any of it** --
    which is also why the e2e suite reads the fixture rather than uploading its own each run.
  - _A drive-by fix to a real drift in the seed._ `findAssignmentsForExercise` returned the group's
    assignments in whatever order core-api listed them, while callers pick "the primary assignment"
    by position -- so an earlier run had submitted its solutions to a _different_ assignment than a
    later one, leaving this instance with two solutions noted `[seed] correct` under two
    assignments. Now sorted by creation time. The e2e test walks the teacher's review queue rather
    than assuming which row is the flagged one, and says why.
  - _Observations:_ **118 e2e tests pass** (116 before), 55 unit tests. The report was rendered with
    real uploaded data, marks and all -- not a state this project has had for its last three
    screens.

- **[2026-08-29 19:35] S-020:** Shadow assignments, the kind with nothing to submit.
  `app/[locale]/(app)/shadow-assignments/[shadowId]/page.tsx`,
  `components/assignments/shadow-points-table.tsx`, `lib/api/shadow-assignment.ts`,
  `lib/actions/shadow-points.ts`.
  - _Everything odd about this screen follows from one fact: nothing is submitted._ An oral exam, a
    presentation, attendance -- ReCodEx evaluates none of it, so there is no submit action, no
    attempts, no evaluation badge, and **the deadline is stated as informative in those words**,
    because core-api's own documentation says the supervisor decides whether it was breached. These
    are the only points in the product a person types in rather than a pipeline computing.
  - _Who sees whose points is core-api's answer, not this page's._ `viewAllPoints` decides what the
    response contains -- every record, or only the reader's own
    (`ShadowAssignmentViewFactory::getAssignmentPoints`) -- so one fetch feeds the teacher's table
    and the student's "my points", and there is no branch here free to disagree with the API.
  - _Each award says who recorded it and what date it is claimed for._ `awardedAt` is the teacher's
    statement about when the work happened, which is not when the record was typed; the legacy
    screen keeps the two apart and so does this one. Awarding goes through S-009's `UserPicker`
    rather than a roster of the group: core-api takes a user id and decides for itself who may be
    awarded, and a second roster here would be a second answer to who belongs to the group.
  - _The group's assignments tab now lists them, under their own heading (DEC-079)._ That is where
    the legacy group screen puts them and it is the only way this page is reachable. **Not rows in
    the assignment table**: every column of that table is about a submission, so merging would mean
    four blank columns and a status that has to be invented -- and the filter deliberately does not
    apply to them, because none of its four states can.
  - _Seeded, since none existed anywhere._ One shadow assignment with points awarded to Alice,
    created the way core-api requires: an empty record, then `update-detail` carrying its `version`
    (optimistic locking), then the points. **This also unblocks S-025**, whose row said it needed
    exactly this data.
  - _Verified live as both people:_ the teacher's table, editing an award and seeing it change,
    awarding a second student and withdrawing it again, and the student's own points with no trace
    of anyone else's. **120 e2e tests pass** (118 before), 55 unit tests.
  - _Backlog correction found on the way:_ **T-017 ("group exam locks") was already shipped by
    S-008** -- locking, unlocking, the live roster and the lock records all live on the Exams tab.
    Marked done rather than left as a ticket someone would open and find finished.

- **[2026-08-29 19:55] S-021:** The user profile, and "my profile" as the same screen.
  `components/users/profile-view.tsx`, `lib/api/user-profile.ts`.
  - _Reached from every roster that has been linking here since S-007._ That link is why the route
    already existed as a stub; it now has the screen behind it: who the person is, and the groups
    they study or teach in.
  - **_A user carries no `permissionHints` at all (DEC-080)._** Verified live: the field is `null`
    even for a superadmin reading a student, because core-api gates the _fields_ rather than the
    entity -- `privateData` is built only under `canViewPrivateData`, and `/v1/users/{id}/groups`
    403s under `canViewGroups`. So this screen renders whichever rows arrived and **attempts** the
    group list, reading a 403 as "not disclosed to you" -- an absent section, not a refused page,
    because the reader may legitimately see the name a roster link promised them. Confirmed by
    having a student open another student's profile: a name, and nothing else.
  - **_`/profile` renders the profile rather than redirecting to it (DEC-081)._** The redirect was
    the first version, and it cost an extra round trip on every visit _and_ left the page
    mid-navigation for anything looking at it -- the **token-leakage test started failing
    intermittently** with "the page is navigating and changing the content", which is the most
    expensive kind of failure to leave for later. One component, two routes, no race; the test's
    original form was restored rather than taught to wait.
  - _Three links this screen deliberately does not have yet:_ editing one's own account (S-022),
    taking over an account (AD-003 -- the BFF route has existed since F-020, only the button is
    missing) and the per-group solutions list (T-005). Each ticket now says it owes this screen its
    own control, which is DEC-066's rule applied forward.
  - _Observations:_ **122 e2e tests pass** (120 before), 55 unit tests.

- **[2026-08-29 23:15] S-022:** The reader's own account.
  `app/[locale]/(app)/profile/edit/page.tsx`, `components/users/account-forms.tsx`,
  `lib/actions/account.ts`, `lib/api/user-settings.ts`.
  - _Four things, four submits._ Name and email; the password; what ReCodEx emails you (a language
    and twelve flags, core-api's own list); and **the iCal tokens a calendar app subscribes with,
    which closes Q-014** -- the capability S-003 was almost credited with and did not build.
  - **_Changing a password ends the session, so the form says so and acts on it (DEC-082)._**
    core-api sets a token validity threshold on the change, which kills the token that made the
    request: every later click would 401 on a page that still looks signed in. The form signs out
    through this app's own logout route and lands on `/login`. It is separate from the profile form
    for the same reason -- name, email and the Gravatar toggle share an endpoint with the password,
    and one combined form would cost a session for correcting a name.
  - _About oneself only._ core-api's `canUpdateProfile` would let an administrator edit someone
    else and the legacy app uses one page for both, but here the id comes from the **session**, not
    the URL -- there is nothing to tamper with, and editing another account is AD-002's screen.
  - _The calendar section states what a calendar link is._ A bearer URL: whoever holds it reads the
    deadlines, with no other authentication. Expiring is the only revocation core-api offers -- the
    record stays, marked -- so expired links stay listed rather than disappearing as if they had
    never been made.
  - _Verified live as the seeded student:_ a profile field saved and put back, a notification flag
    toggled and put back, and a calendar link created, **fetched directly (a real `VCALENDAR`
    feed)**, then expired -- after which the same URL answers 400.
  - _What the e2e suite deliberately does not do:_ change a password. It would invalidate the
    seeded account for every other spec, with no way to put it back; the spec asserts the form's own
    rule (the two new passwords must match) instead, which is the part this app owns.
  - _Observations:_ **125 e2e tests pass** (122 before), 55 unit tests.

- **[2026-09-01 08:05] S-023:** The page an invitation link leads to.
  `app/[locale]/(app)/accept-group-invitation/[invitationId]/page.tsx`,
  `components/groups/invitation-accept.tsx`, `lib/api/group-invitation.ts`,
  `lib/actions/group-invitation.ts`.
  - **_The button follows core-api's hint, not the reader's role (DEC-083)._** The legacy page
    refuses anyone who is not a student outright -- "the invitation links are available only to
    students, supervisors may not use them" -- and core-api simply does not agree: verified live, a
    supervisor, a supervisor-student **and** a superadmin all read `acceptInvitation: true` on the
    same invitation, because every role inherits the `student` rule. Constraint 4 decides which of
    the two answers this app uses. So the button is offered on the hint, and the page says what
    accepting does instead: _enrols you as a student of this group_.
  - _One request answers the whole screen._ `GET /v1/group-invitations/{id}` returns the invitation
    **plus the ancestral closure of its group** -- core-api's own reason is "so a name can be
    constructed", and "Lab A" alone does not tell a student which course they are joining. The
    group's administrators are named through the same batched `POST /v1/users/list` the roster
    screens use, and whether the reader is already a member comes from `getMyGroups()`, which the
    app shell has already fetched for its sidebar on that very render.
  - _Every reason the button can be missing is a sentence, not a greyed-out control._ Expired,
    organizational, archived, already a member -- four states, four different things to say.
    Expiry and `organizational` are mirrored from core-api's `checkAccept` because the hint does
    not carry them; **`archived` deliberately is not**, since `group.isNotArchived` is already a
    condition on that hint's own rule and a second copy here would be free to drift.
  - _Seeded, since no group had a single invitation and every branch was unreachable._ Five links:
    open, expired, on a group already joined, on an organizational group, on an archived one. An
    archived group still accepts new invitations -- only accepting them is refused -- which is what
    makes that last fixture possible at all.
  - _Verified live as the seeded student:_ all five states in both locales, a dead invitation id
    reading as the not-found page, and the accept itself end to end -- the toast, the redirect to
    the group's assignments, the sidebar gaining the group, and the same URL then rendering "you
    already study here". Alice was removed from the group again afterwards.
  - **_What the e2e spec deliberately does not do: accept._** It would leave the account enrolled
    with no way to put it back, because **leaving a group is a legacy capability this app has not
    built** -- found here, now **backlog S-026** (joining a public group is the other half of the
    same gap). The other five states are asserted. The invitation ids come from core-api through a
    new `e2e/helpers/core-api.ts`, the only fixture in the suite not found by clicking: an
    invitation link genuinely arrives out of band, and until T-018 there is not even a list for the
    person who minted it. **T-018 is unblocked** and owes that helper its retirement.
  - _Also:_ `localizedDescription` was a private copy inside `group-detail.ts`; it now sits beside
    `localizedName` in `lib/i18n-text/localized.ts`, where the second caller found it.

- **[2026-09-01 08:25] S-024:** The invitation that arrives by email, and the account it creates.
  `app/[locale]/(anon)/accept-invitation/page.tsx`, `components/users/accept-invitation-form.tsx`,
  `app/api/auth/accept-invitation/route.ts`, `lib/auth/invitation-token.ts`.
  - _The only screen in the product that creates an account, and the only one reached with no
    session at all._ Everything it shows comes out of the token itself -- there is nobody to ask yet.
  - _The token is the whole query string._ core-api builds the link from
    `invitationUrl: "%webapp.address%/accept-invitation?{token}"`, so what arrives is
    `?eyJhbGciOi...` with no key at all. `?token=` is read too, for a deployment that overrides
    that template, rather than assumed away.
  - **_Decoded on the server; the raw token goes back to the form untouched (DEC-084)._** The
    legacy page parses the JWT in the browser and picks its four-part `usr` array apart there. The
    raw token still reaches the client -- it is already in the address bar, and the form has to
    send it back -- but the parser and the payload do not.
  - **_Nothing here verifies the signature, because nothing here can (DEC-085, Q-018)._** core-api
    signs with a key this app deliberately does not hold, and there is no endpoint that will
    validate an invitation token on its behalf (checked against the whole spec). Nothing is granted
    on what the page displays: a forged link renders a name its own author chose and is then
    refused at submit. The residual -- a legitimate-looking page on the real domain -- is the same
    one the legacy frontend has, and it is written up rather than papered over.
  - **_Accepting mints a session, so it is a Route Handler (DEC-086)._** core-api answers `201`
    with `{user, accessToken}` -- "so the user can log-in right away", in its own comment -- which
    makes this a registration and a login in one call. It joins login, the CAS callback and
    takeover in `app/api/auth/`, so `establishSession()` has exactly one class of caller. The cost
    is a hand-rolled form rather than D-004's kit, whose contract is a Server Action.
  - _Verified live against a **real** invitation token_, minted locally with the instance's own
    signing key because this deployment has no working SMTP and no `mail.debugMode` archive to read
    one from (Q-007): the account was created, verified (core-api marks an invited email verified on
    sight), enrolled in the group the token named, signed in, and landed on the dashboard. The
    account was deleted afterwards. The expired, unreadable and mismatched-password states were
    checked in both locales.
  - _The spec builds its own tokens with a signature that is not real_, which the page's contract
    allows and which is itself the assertion that it does not verify. It covers the three display
    states and the local password check; the submit cannot be tested without core-api's key, and
    that is the one step verified by hand.
  - _One real bug found by writing the spec:_ **every `(anon)` page was missing its `<main>`
    landmark.** `(app)` has always had one in the app shell; login, register, password reset, the
    FAQ and this page had none. Fixed in `(anon)/layout.tsx`.
  - _Observations:_ **136 e2e tests pass** (125 before these two tickets), 55 unit tests.

- **[2026-09-01 09:05] S-025:** The dashboard rows for work with nothing to submit.
  `components/dashboard/shadow-assignments.tsx`, `getStudentDashboard()`.
  - _The points were already here; the names were not._ core-api folds shadow points into the group
    totals the progress cards read, so "8/40" had been counting them all along -- what a student
    could not see was **which** ones. That is one call per group,
    `/v1/groups/{id}/shadow-assignments`, fanned out the same way the deadline table already fans
    out over assignments; `getGroupShadowAssignments` is now memoized so the group screen asking for
    one of them on the same render costs nothing.
  - **_A table of its own, and deliberately not a calendar entry (DEC-087)._** DEC-079 already
    decided the first half for the group screen: every column of a deadline table is about a
    submission, and none of them can be filled in here. The calendar is the same argument one step
    further -- a shadow deadline is the supervisor's note about when the work should happen, and
    core-api's own documentation says the supervisor decides whether it was breached, so drawing it
    beside enforced deadlines would claim a countdown that does not exist. The column says
    "Deadline (informative)" and carries no urgency badge and no relative time.
  - _Rows awaiting points come first_, then by group, then by name -- the ones a reader might still
    act on, ahead of the ones already settled. The teacher's note is shown where there is one, which
    is the column the legacy dashboard's own shadow table has.
  - _Seeded a second shadow assignment with nothing awarded._ The seed made exactly one, always
    awarded, so the "nothing yet" row -- the state most students are in most of the time -- had
    never been rendered. Same reasoning as F-029.
  - **_One real defect found on the way (DEC-088)._** `StatusState` hardcoded `<h2>` for its title.
    That is right for `not-found.tsx` and friends, which render nothing above it, and wrong inside a
    dashboard panel headed by an `<h3>`: "Nothing is due" read as a peer of "My studies", and the
    dashboard spec that enumerates `h2`s **had been failing intermittently at HEAD** for exactly the
    persona with no open deadlines -- confirmed by running it against a stashed tree, so it was not
    this ticket's. `headingLevel` defaults to `2`, so nothing else moved.
  - _Verified live as the seeded student, in both locales:_ both rows, the group total moving from
    8/40 to 8/60 as the second assignment's maximum joined it (which is the fold this ticket is
    about, seen from the other side), and the whole dashboard's heading outline now h1 → h2 → h3 →
    h4 with no jump.
  - _Observations:_ **138 e2e tests pass** (136 before), 55 unit tests.

- **[2026-09-01 09:50] F-031:** A session that outlived its token.
  `proxy.ts`, `app/api/auth/session-expired/route.ts`, `isSessionTokenLive()` in
  `lib/auth/session-cookie.ts`, 401 handling in `lib/api/read.ts`.
  - **_The symptom was worse than the ticket said._** This was filed as "an expired session reads
    as an error page". It does not: it reads as **an infinite redirect loop**. `proxy.ts` tested the
    cookie for _presence_, so a token past its own `exp` still counted as a session --
    `requireSession()` sent the reader to `/login`, `proxy.ts` saw a cookie and sent them back to
    `/dashboard`, forever. Reproduced with `curl` before a line was changed: 12 hops and still
    going, which in a browser is `ERR_TOO_MANY_REDIRECTS` and no page at all. Every ReCodEx token
    lasts seven days, so this is what waiting a week over a holiday looked like.
  - _Both layers now ask one question of one value._ `isSessionTokenLive()` is shared by `proxy.ts`
    and `requireSession()`, so they cannot disagree about whether a cookie counts -- and the
    disagreement _was_ the bug, not either answer on its own. `proxy.ts` clears what it rejects,
    because it is the only layer that both sees the request and can write a cookie.
  - **_The other way a session dies is invisible to that check (DEC-089)._** core-api can refuse a
    token whose `exp` has not passed: a password change sets a validity threshold (S-022's own
    finding, from the other side), and an administrator can invalidate every token a user holds.
    That answer arrives as `401` during a render, where no cookie can be written -- so
    `lib/api/read.ts` redirects out to a Route Handler that clears it and lands on `/login`. Two
    mechanisms because there are genuinely two failures.
  - _Verified live, both paths, with a cookie jar so `Set-Cookie` actually took effect:_ expired by
    `exp` resolves in one redirect to `/en/login?from=/en/dashboard`; refused by core-api resolves
    in three, through `/api/auth/session-expired`; the cookie is gone in both. A healthy session
    still reaches `/dashboard` untouched, and still bounces `/login` back to `/dashboard`.
  - _The spec's strongest assertion is that `page.goto()` returns at all_ -- a loop fails it
    outright. Both new tests were confirmed to fail against a stashed tree and the control to pass
    in both states, the way F-024's were.
  - _What is still rough:_ a **Server Action** that hits the same 401 shows core-api's own message
    ("Access token ... is not valid") in the form rather than signing the reader out. It
    self-corrects on their next navigation, and it is on F-031's backlog row rather than invented as
    a ticket, because no capability is lost -- only the wording of one failure.
  - _Observations:_ **141 e2e tests pass** (138 before), 55 unit tests.

- **[2026-09-01 10:40] S-026 + T-018:** The two ways into a group that are not an invitation, and
  the links themselves. `lib/actions/group-membership.ts`,
  `components/groups/membership-button.tsx`, `components/groups/invitation-manager.tsx`,
  `getGroupInvitations()`, `requestOrigin()`.
  - **_S-026 is the one screen in this app that reads an ACL's conditions instead of a permission
    hint, because there is no hint to read (DEC-090)._** `addStudent` and `removeStudent` are
    **absent from a group's `permissionHints` entirely** -- confirmed live, the keys are missing
    rather than `false` -- because both rules are written against a _student_ subject
    (`student.isSameUser`, `student.isNotGroupLocked`) and a hint computed for the group alone has
    nobody to put there. Same shape as DEC-080's user objects. So the conditions are restated from
    fields the page already holds, and core-api decides for real: joining a group that is not public
    answers 403, verified live.
  - _Neither action takes a user id._ It comes from the session, so there is nothing in the request
    that could enrol somebody else -- S-022's reasoning applied to a second screen. The offer's shape
    is the legacy screen's own, down to **a group's admins and supervisors being shown neither
    control**: core-api would permit it, and for the administrator of a course "join" is a misclick.
    Putting _other_ people in and out stays in S-009's member manager, gated on `update`, which is a
    different question with a different answer.
  - _Seeded `[seed] Open Enrolment`._ No group was public and unjoined, so the Join control -- the
    only way into a group without an invitation -- had never been rendered. Making it public found a
    real trap on the way: `actionUpdateGroup` replaces the whole group with what it is sent, and
    omitting `externalId` is a **500**, not a 400.
  - _T-018 puts the links on the Settings tab._ Create, edit, delete. Expired links stay listed and
    marked, because letting one lapse and deleting it are genuinely different -- the first can be
    given a new date, the second 404s forever -- and a link quietly vanishing is how a teacher ends
    up minting a second one for the same class.
  - **_The link is printed in full, from the request's own `Host` (DEC-091)._** It is the thing being
    handed out, so a copy button over an invisible value would not do. `API_BASE_PUBLIC` was the
    tempting shortcut and is wrong: it names core-api, which is the same origin in the compose
    deployment and a **different port** in local development, so the link would work in production
    and quietly not on a developer's machine.
  - _`editInvitations` is granted separately from `update` in core-api's ACL_, so the Settings tab
    now appears for a reader who may only mint links -- it used to require one of the other four.
  - _Verified live as the seeded student and as the superadmin:_ join, the sidebar and "my standing"
    appearing, leave with its confirmation, and the group back to zero students; then a link created,
    a past expiry refused by the form before core-api was asked, an empty expiry saved as "never
    expires", the note edited, and the link deleted -- in both locales.
  - _What T-018 did **not** retire:_ `e2e/helpers/core-api.ts` survives. An organizational group
    shows no invitation section (nobody can be enrolled in one), so two of the five seeded fixtures
    are still unreachable by clicking. The ordinary case is now clickable, and the management spec
    exercises it.
  - _Both specs undo what they do_, and both start by clearing anything a crashed earlier run left
    behind -- which was not paranoia: three failed attempts at the membership spec each left the
    account enrolled, and that is exactly how the next run starts from the wrong state.
  - _Observations:_ **146 e2e tests pass** (141 before), 55 unit tests.

- **[2026-09-01 11:20] T-003:** Every attempt at one assignment.
  `app/[locale]/(app)/assignments/[assignmentId]/solutions/page.tsx`,
  `components/assignments/solutions-table.tsx`, `lib/api/assignment-solutions.ts`.
  - _One row per **submission**, where S-013's class progress is one row per student._ That is the
    whole difference, and it is what a teacher wants when they are looking at a particular attempt
    rather than at how the group is doing: the seeded student appears three times here and once
    there. Each row opens its own solution, not the author's best one.
  - _Both screens are gated on the same hint._ `viewAssignmentSolutions` decides whether the class
    progress renders and whether this link is offered; the page itself asks core-api and lets a 403
    become F-030's refusal, so a student who types the URL is refused rather than quietly shown
    everyone's work. Verified as both people: the teacher has the link and the page, the student has
    neither.
  - _The assignment screen owes this one a link, and now has it (DEC-066)._ "Edit assignment" is
    still absent, because T-002 has not built that screen.
  - _`pastDeadline` is a count of seconds, not a boolean_ -- `0` for on time. Read as a number, or
    every solution reports as late.
  - _The badge is rendered inline rather than through `EvaluationBadge`._ Not a duplicate: the state
    still comes from `evaluationStatus()`, the one function the solution screen and the dashboard
    also ask, but `DataTable`'s columns must be defined inside the client boundary and
    `EvaluationBadge` is a Server Component. The tone and the label come from the same table either
    way, so the two cannot disagree about what a solution's state is.
  - _Everything is fetched at once and the table filters in the browser_, the same trade
    `getGroupList` makes and Q-015 records: core-api offers no paging on this endpoint.
  - _Verified live in both locales_, and the filter's URL round trip asserted: filtering to one
    author, sharing the URL, and getting the same view back.
  - _One flaky assertion fixed on the way, in the dashboard's spec._ It read the deadline table with
    `evaluateAll`, which does not auto-wait, while that section is streamed behind a `Suspense`
    boundary -- so it was asserting order on whatever had arrived, and S-025's extra fan-out per
    group was enough to make it lose the race. It now waits for the first row, the way the test
    beside it already did.
  - _Observations:_ **150 e2e tests pass** (146 before), 55 unit tests.

- **[2026-09-01 12:10] T-002:** Everything about an assignment its author decides.
  `app/[locale]/(app)/assignments/[assignmentId]/edit/page.tsx`,
  `components/assignments/assignment-form.tsx`, `components/assignments/sync-with-exercise.tsx`,
  `lib/api/assignment-edit.ts`, `lib/actions/assignment.ts`.
  - _Visibility, deadlines and points, submission limits, what a student sees of the evaluation, and
    the per-locale hint._ Not the exercise: the text, the tests and the resource limits belong to
    the exercise this was copied from, and changing those is T-008/T-010's screen.
  - **_One form and one save, because core-api replaces the assignment with what it is sent
    (DEC-092)._** There is no partial update, so every save carries every field it reads -- a field
    omitted is a field reset. S-022's four-forms split would hide that rather than help, since each
    would still POST the whole thing. `version` rides along as the optimistic lock, and its
    `400-010` is surfaced verbatim rather than retried: the honest answer to "someone else saved
    first" is to reload and look at what changed.
  - **_A real gap the spec found: a student could open the settings form._** `apiRead`'s 403 does
    not fire here, because _reading_ an assignment is something a student may legitimately do -- it
    is their assignment -- and only the save would have been refused. The page now asks `update`
    itself and calls `forbidden()`. Nothing was ever writable, but being handed a filled-in form for
    something you may not change is its own defect.
  - **_The re-sync button S-013's notice had only been reporting._** Everything at once, not a
    selection of parts: core-api accepts a list, and offering one would ask a teacher to choose
    between "score config" and "exercise config". Offered only where `isSynchronizationPossible` --
    a drifted assignment whose exercise has since been deleted has nothing to sync _from_.
  - _A second a11y wart fixed on the way._ The form's first draft put each field's hint **inside**
    its `<label>`, which makes a screen reader announce "Attempts allowed How many times one student
    may submit" as the field's name. Found because the spec could not match a label exactly. The
    hint is now `aria-describedby`, the way `components/form/text-field.tsx` already did it.
    `components/users/account-forms.tsx` still has the older shape; noted rather than swept in.
  - _Verified live, both locales:_ a setting changed and put back through the form (the value
    round-trips through core-api, so this is a real save, not a re-render), the second-deadline
    fields appearing and disappearing with their toggle, a second deadline before the first refused
    by the form without a round trip, and a student refused both the link and the URL.
  - **_The re-sync is verified by hand, not by the spec._** Making an assignment drift means editing
    the exercise it came from, and no screen in this app does that until T-008 -- so the spec has no
    way to create the state. Done manually instead: the exercise's text was changed, the notice
    named `localizedTexts` as stale, the button synced it, and the exercise and assignment were both
    put back exactly as seeded.
  - _Observations:_ **153 e2e tests pass** (150 before), 55 unit tests.

- **[2026-09-01 12:55] T-001:** Assigning an exercise, and the undo it needed.
  `app/[locale]/(app)/groups/[groupId]/assign/page.tsx`,
  `components/assignments/exercise-picker.tsx`, `components/assignments/delete-assignment.tsx`,
  `lib/api/exercises.ts`.
  - **_Create first, configure second (DEC-093)._** core-api has no call that creates an assignment
    _and_ configures it, so the choice was a wizard holding settings in the browser until the end,
    or creating with core-api's defaults and going straight to T-002's form. The second is the
    legacy flow and the one that fails better: nothing is lost if the tab closes halfway, and the
    assignment is created **invisible**, so it harms nobody while it is half-configured. It also
    means one settings screen rather than a create-shaped copy of it.
  - **_The catalog is searched server-side_** -- the one list in this app that is not fetched whole.
    `/v1/exercises` is genuinely paginated and an instance can hold thousands, so Q-015's
    fetch-everything trade does not carry over; the page says how many matched in total rather than
    quietly showing the first twenty-five as if that were all of them.
  - _Five things can refuse an assignment and the picker can see three._ The exercise's `assign`
    hint, locked and broken are in the payload and are named on the row; the group's
    `assignExercise` gates the page; the fifth -- **an exercise with no reference solution** -- is in
    no list payload at all, so core-api's own message is what the reader gets on the attempt.
    Predicting it would cost a request per row.
  - **_Writing the spec turned up the same shape S-026 was filed for: a one-way door._** Nothing in
    this app could delete an assignment, so assigning the wrong exercise would have been permanent.
    Deletion now sits at the bottom of T-002's settings screen, on core-api's `remove` hint, and it
    confirms -- every solution submitted to the assignment goes with it. The spec creates a real
    assignment, lands on its settings, and deletes it again, so it leaves nothing behind and can run
    twice; the group's assignment count is the same before and after.
  - _Verified live in both locales_, and the group was left with exactly its three seeded
    assignments.
  - _Observations:_ **155 e2e tests pass** (153 before), 55 unit tests.

- **[2026-09-01 13:30] T-006 (and T-004 found already shipped):** Points, assignment by assignment.
  `components/groups/points-matrix.tsx`, `getGroupPointsMatrix()`.
  - _S-007's roster answers the row question -- how is this person doing -- and stopped there._ This
    is the column question: who has not done which piece of work. It sits under the roster on the
    Students tab, which is where S-007's note said it belonged.
  - _Both tables come out of the same response._ `/v1/groups/{id}/students/stats` already carries a
    row per student with an entry per assignment, so the matrix costs one call for the assignment
    **names** and nothing for the data.
  - **_A cell tells "never submitted" from "every attempt failed" -- the first thing to close any
    part of Q-012._** Both look identical in the stats (`status: null`, no best solution), and
    calling them the same thing is exactly the complaint that question records about the dashboard.
    `/v1/assignment-solvers?groupId=` answers it for the whole group in **one** call, which is the
    only reason the distinction is affordable: a dash means nothing was sent, an exclamation mark
    means attempts were made and none produced a result.
  - _Not a `DataTable`._ Its columns are data rather than a schema, so a sort control would sort by
    a column that may not exist tomorrow, and a filter box over a matrix hides the shape that makes
    it readable. It scrolls sideways with the name column pinned.
  - _Shadow assignments have no column._ Their points are inside the row totals -- core-api folds
    them in, which is what S-025 found from the other side -- but nothing is submitted for them, so
    a column would be blank by construction. DEC-079's reasoning for the third time.
  - **_T-004 was already done._** "Submitted count, average score" is precisely what S-013's four
    tiles on the assignment screen show, down to the average being taken over students whose best
    solution was _scored_. Marked done with that note rather than left as a ticket someone would
    open and find finished -- the same correction S-020 made for T-017.
  - _Two existing specs needed scoping, not fixing:_ the roster test and the profile test both
    reached for "Alice Student" on the Students tab, which is now named in two tables.
  - _Observations:_ **156 e2e tests pass** (155 before), 55 unit tests.

- **[2026-09-02 21:40] P-001:** The parity sweep, and what it found.
  `docs/INVENTORY.md` (every status re-derived), `docs/BACKLOG.md` (G-001..G-029).
  - _All 138 rows were read against the code rather than against the plan._ **65 status cells were
    wrong**, and wrong in both directions: 40-odd rows still said `todo` for screens that shipped
    months ago (`app/archive`, the solution screen, `*`, `evaluationProgress`, `i18n`,
    `Breadcrumbs`, `Nested subgroups`, `Judge log display`), and a dozen said `done` for rows whose
    write half was never built. The file had been consulted as the parity contract while saying
    almost nothing true about it since May.
  - **_The sweep's real finding is a shape, not a list: this app reads well and writes badly._**
    Twenty-nine gaps came out of it, and **fourteen of them are one button against an endpoint
    `lib/api/core-api.generated.ts` already types and no code calls** --
    `assignment-solutions/{id}/set-flag/{flag}`, `/bonus-points`, `/resubmit`,
    `/download-best-solutions`, `shadow-assignments` POST/DELETE, `POST /v1/groups`. The pattern is
    consistent enough to be a lesson: a ticket that says "the X screen" got read as "render X", and
    the actions on that screen went with the screen they were on rather than being tickets of their
    own. `reviewRequested` is the sharpest instance -- **S-002 built the teacher's queue of
    requested reviews, the field is read in four places, and nothing in this app can set it.**
  - _Three of them are things a person simply cannot do._ **A group cannot be created** (G-008), so
    a course cannot be started here at all; a shadow assignment cannot be created or edited (G-009),
    which is why `scripts/seed.ts` makes them by raw API call; and a teacher cannot override the
    points a solution scored (G-001), which the landing page A-001 shipped happens to advertise.
  - **_Two brief §7 landmines were checked and one of them had been stepped on._** Pipeline
    visualisation survived; **solution diffing did not** (G-005). It is named in three inventory
    rows, its "Action Required" column says "Keep capability", and nothing was built -- no route, no
    component, no dependency. That is the one gap here that is a whole screen rather than a control.
  - _And the last `PlaceholderPage` in the product is linked from the front page._ `/faq` (G-024)
    is reachable, public in `proxy.ts`, in the breadcrumb manifest, and pointed at by the landing
    page's second call-to-action -- so the one page a visitor is invited to open says "This page
    hasn't been built yet."
  - **_Every claim was made twice, by readers with opposite jobs._** Six readers each took a slice
    of the inventory; each slice's claimed gaps then went to a second reader whose instructions were
    to refute them, with "default to refuted when in doubt". **Four died there** and are not in the
    table: the effective-role switch (recorded in DEC-043 -- though as a deferral to a ticket nobody
    ever filed, so it is G-023 for that reason instead), inviting a person who has no account
    (moved to `create-user.tsx`, the auditor looked for the legacy endpoint rather than the
    capability), bulk-assign settings (DEC-101), and the multi-account switcher (DEC-112 names it in
    its rejected-alternatives column). A gap that survives that is worth a ticket.
  - _Four rows are now `n/a` rather than `todo`._ `hwGroups` and `runtimeEnvironments` have no admin
    screen in the legacy app either -- AD-006 found that out the hard way (DEC-114) and the
    inventory was never told; the SIS integration has no legacy screen at all. The inventory's
    status vocabulary is documented at the top of the file now, since it has four values.
  - _Not verified against a running legacy instance._ Source is the primary reference (brief §10),
    and every gap cites the legacy file and line that proves the capability exists there.
  - _Observations:_ **no code changed**, so the tree is untouched: 156 e2e tests, 55 unit tests,
    `typecheck`/`lint`/`build` clean before and after.

- **[2026-09-02 22:10] P-006:** Where every old link goes, and the fact that none of them go there
  yet. `docs/ROUTES.md`, rewritten.
  - _The file was the recon plan, and the plan lost._ It promised `/groups/[id]/info`,
    `/reference-solutions/[id]`, `/admin/server` and `/[...not-found]`; **none of those four
    exist.** Rewritten against `next build`'s own route listing rather than against the intention.
  - **_And it had missed the change that actually breaks every old link._** `localePrefix: "always"`
    means there is no `/dashboard` -- there is `/en/dashboard` and `/cs/dashboard`. A redirect table
    that ignores that sends every bookmark to a 404, so it is now the first thing the file says.
  - _The second-order version of the same problem is the tabs._ Six legacy group routes are one
    route and a `?tab=`, so those redirects need a **query string**, not a path rewrite -- and they
    have to be ordered before the generic `/app/:path*` rule or it swallows them.
  - **_Nothing redirects today, and that is currently harmless._** `next.config.ts` has no
    `redirects()` and `proxy.ts` rewrites nothing but the locale; nginx still serves the **legacy**
    app at `/` and this one answers only on its own host port. So the table is what has to exist
    **before** cutover -- a deployment task rather than a code one. R-004 is open because of it: if
    both apps stay reachable, the `/app/:path*` catch-all must not be added at all, or the legacy
    app becomes unreachable through its own URLs.
  - _Two redirects lose information on purpose_ and the file says which and why: `/login/:redirect*`
    drops its target (the legacy segment carries no locale, and landing someone on the
    wrong-language version of the page they asked for is worse than the dashboard), and both
    instance routes land on the merged screen (DEC-113).
  - _Two rows have nowhere to point:_ the solution diff (G-005) and the shadow-assignment editor
    (G-009). A redirect to an unbuilt route is a 404 with an extra hop, so they wait for the tickets.

- **[2026-09-02 22:25] P-007:** Telling a drop apart from a hole. `docs/DROPPED.md`, rewritten.
  - **_The recon draft invited exactly the wrong inference._** Twenty items, **nineteen of them
    libraries** -- swapping `moment.js` for `date-fns` drops nothing a person can do. A reader
    arriving at a file called DROPPED.md reasonably concludes it enumerates what the new app cannot
    do, and it never did. The rewrite says so in its second paragraph and splits the three kinds of
    absence: a deliberate drop, unbuilt work (the G block), and a replaced library.
  - _Only **four** capabilities are genuinely dropped_, each with a decision behind it: returning to
    your own account after a takeover (DEC-112), assignment settings during a bulk assign (DEC-093),
    the seven view preferences (**provisional** -- G-022 is the ticket that decides), and
    `URL_PATH_PREFIX` as a _runtime_ setting, which Next resolves at build time.
  - **_Two rows were taken off the drop list, because a deferral with no ticket behind it is not a
    drop._** DEC-043 left the effective-role switch and the application-token form to "a future
    ticket" that was never filed, which is precisely how an oversight comes to read as a decision.
    They are G-023 and G-020 now.
  - _PEND-001, PEND-002 and DROP-020 are closed or restated._ The monitor WebSocket was kept and is
    both mechanisms (DEC-065, closing DEF-004); viz.js is dropped **and its capability kept**, laid
    out and drawn server-side with no Graphviz at all (DEC-107, closing DEF-003); the extension
    token handoff stays genuinely open (DEF-005), and G-020 is the conservative thing brief §7 asks
    for.
  - **_Two library rows are left deliberately untidy._** `react-ace` and `react-diff-viewer` were
    filed as swaps, and for those two "we replaced the library" quietly meant "we did not replace
    the capability". They stay visible, pointing at G-028 and G-005, rather than being cleaned away.

- **[2026-09-02 22:45] P-005:** A README, and the hour it is meant to save. `README.md` (new).
  - _The repo had no README at all_ -- brief §14 wants a fresh developer to clone, install,
    `pnpm dev` and be productive from it alone, and there was nothing to be productive from.
  - **_The single most useful paragraph in it is about a hostname._** The compose stack sets
    `APP_DOMAIN=recodex.local`, which is not in anybody's `/etc/hosts`; inside the network the
    services reach each other by service name and from the host they are only on `localhost`. That
    trap is already recorded in this repo's own `.env.local` comment, having been hit here, and it
    is the first thing a new developer will hit too. It gets its own callout rather than a footnote.
  - _`.env.example` is treated as the configuration documentation_ rather than duplicated. It
    already carries verified values and a comment per variable saying what breaks; the README says
    to read it and calls out only the internal/public split and the build-time `URL_PATH_PREFIX`.
  - _Five things the file names do not tell you:_ the token never reaching client JS (with the test
    that proves it), `proxy.ts` not being `middleware.ts`, `proxy.ts` not being the authorisation
    boundary either, permissions coming from hints rather than role names, and `aria-label`/`title`/
    `sr-only` counting as user-facing text for the both-locales rule.
  - **_It says plainly that the app is not at parity._** A reader who sees every phase marked done
    would reasonably assume it is; the `docs/` section warns that G-001..G-029 exist and that a
    screen rendering is not the same as a screen being finished.
  - _Deployment and cutover are separated_, because the cutover is not a code change: nginx serves
    the legacy app at `/` today, and the redirect work, the `core-api` frontend-URL setting and the
    question of whether the old app stays reachable are all operator decisions (P-006's R-004).
  - _And the three local environment limits are stated up front_ -- no real pass/fail on cgroup v2,
    no SMTP, six runtime environments -- because each one makes a screen look broken when it is not.
  - _Every claim in it was checked against the file it describes_, not written from memory: the CI
    job list, the security spec's two assertions, the licence, `.nvmrc`, the compose service's
    environment block and the published port.

- **[2026-09-03 00:20] P-002:** The accessibility pass. 103 files, `messages/{en,cs}.json`, DEC-118.
  - _Audited in six lenses_ -- the shell and the palette, forms and dialogs, tables and widgets,
    per-route structure and headings, colour and contrast, asynchronous updates -- and **every
    finding was then handed to a second reader whose instructions were to refute it**, with
    "default to refuted when in doubt". **56 survived, 8 did not.** The refuted ones are the reason
    to do it that way: most were ARIA that Radix already supplies, and adding it would have been a
    regression rather than a neutral change.
  - **_The findings clustered in three places, and none of them was where a checklist would look._**
    First, **the shared `DataTable`** -- the weakest widget in the codebase and the one behind the
    group list, the roster, the solutions table and the failure queue: no `aria-sort`, no `scope`,
    an `aria-hidden` arrow as the only sort indicator, no accessible name, no announcement when
    filtering or paging changed what is on screen, and a literal "Select row" on every bulk
    checkbox. The bespoke tables around it were in better shape than the shared one.
  - _Second, **the light theme was systematically under-saturated**._ Contrast was computed rather
    than eyeballed, and the numbers are in the commit: the focus ring was **2.6:1** against white
    (the floor is 3:1) and every control paired it with `outline-none`; every non-neutral badge
    rendered its label in the same hue as its own background tint; the destructive confirm button
    was `text-white` on a fill that could not carry it in dark. The dark theme passed everywhere it
    was measured.
  - _Third, **things that were said in colour or in a `title` attribute alone**._ The points matrix
    is the sharpest: the "nobody submitted" versus "everything failed" distinction that T-006 built
    the whole table for was **a glyph and a tooltip**, reachable by hovering and by nothing else.
  - **_One CSS line was erasing table semantics across every exercise text in the product._**
    `[data-slot="markdown"] table { display: block }` -- a scroll fix -- strips `table`/`row`/`cell`
    roles from every GFM table an author has ever written. The scroll box is now a wrapper element,
    which was always the right shape for it.
  - _And all 46 routes shipped the identical `<title>ReCodEx</title>`_, because only the locale
    layout set metadata. 45 now carry their own, taken from the namespace each page **already** uses
    for its `<h1>` -- so **no page gained a data fetch to have a title.** Dynamic routes are titled
    with their section ("Group", not the group's name): naming the entity means fetching it a second
    time in `generateMetadata`, and with `cacheComponents: false` that is a real extra round trip on
    every render. The landing page is the one deliberate omission -- its heading _is_ the product
    name, so feeding it the template would render "ReCodEx · ReCodEx".
  - **_One fix was built, measured, and taken back out (DEC-118)._** The loading skeleton's
    `role="status"` had nothing to read, so it was given translated text -- which meant a client
    component, because a `loading.tsx` is a `Suspense` fallback and must be synchronous. `next build`
    then showed `/faq` and `/forgot-password`, **the only two prerendered routes in the app**,
    turning dynamic. Confirmed by bisection rather than assumed: reverting that one file brought
    both back to `●`. The role is now applied only where a caller passes a label, which the streamed
    dashboard panels do and a `loading.tsx` cannot.
  - _Half the work was cross-file follow-ups_, because a fix in a shared component is not finished
    until its callers use it: `DataTable` gained a `caption` prop and six tables had to pass one;
    `ErrorState` gained `headingLevel` and the dashboard had to pass it; `--destructive-foreground`
    changed and the design-system gallery had to stop hardcoding `text-white`.
  - **_One e2e assertion had to move in the same commit, and it is worth naming why._**
    `groups.spec.ts` read the points matrix with `allInnerTexts()`. `sr-only` text is **clipped, not
    hidden**, so it is part of `innerText` -- the moment the explanation moved out of a `title`
    attribute and into visually hidden text, that assertion was reading `"!Every attempt failed…"`
    and comparing it to `"!"`. It now reads the decorative span, and asserts the sentence separately.
  - _A session limit killed three of the six appliers mid-edit._ Their partial work was reverted to
    HEAD rather than salvaged -- unreported edits and unreported message keys are worse than none,
    since a missing key is a runtime failure a build cannot catch -- and those three groups were
    re-run from the same findings.
  - _Verified:_ `typecheck`, `lint`, `format:check`, `build`, **170 unit tests**, **257 e2e tests**,
    all green, and `/faq` and `/forgot-password` still prerender.
  - _Observations:_ **not re-audited after the fixes, and no assistive technology was used at any
    point** -- everything here is contrast arithmetic and reading the accessibility tree out of the
    source. A screen-reader pass by a person is the thing this ticket could not do, and it is in
    `RETROSPECTIVE.md` §5.12 as such.

- **[2026-09-03 00:40] P-003:** The performance pass, and the five things it measured and did not do.
  `components/app-shell/app-shell.tsx`, `lib/api/{groups,group-detail,assignment-solutions,reference-solutions,assignment,solution,dashboard}.ts`,
  `lib/status/evaluation.ts`, three pages, `app/api/search/route.ts`, `components/app-shell/sidebar-nav.tsx`, DEC-119.
  - **_Nothing in this app had ever been profiled_**, so there was no baseline to compare against and
    the audit reasoned from the code instead: round trips counted in the source, bytes counted out of
    the real build. Five lenses, and **every finding handed to a second agent told to refute it: 25
    confirmed, 23 refuted.**
  - **_The refuted half is the interesting half._** Most of it was duplicate `GET`s that Next 16
    already collapses -- the auditor read `node_modules/next/dist/server/lib/dedupe-fetch.js` rather
    than assuming, found that identical GETs are memoized per render pass, and downgraded every
    "duplicate request" finding to "duplicate parse". Without that pass this ticket would have
    "fixed" a dozen things that were not broken.
  - **_The sharpest real finding is a memoization bug that looks like correct code._**
    `fetchVisibleGroups(scope = "active")` is wrapped in React's `cache()`, and **`cache()` keys on
    the argument list as passed** -- so `f()` from the sidebar and `f("active")` from the group list
    are two different entries, and the unpaged whole-instance `/v1/groups` payload was fetched and
    parsed twice on `/groups` and every exercise route. The default now lives in a thin wrapper
    _outside_ the memo boundary, so no future call site can re-open it by writing `f()` again.
  - _The same class of bug, twice more, on the group's Students tab_, where the page's own comment
    claimed the two tables shared one response and they did not: the heaviest per-group payload in
    the app (`students/stats`) and a `POST /v1/users/list` were each fetched twice. Both are shared
    through `cache()` now -- the POST keyed on a **sorted joined id string**, because keying on the
    array would memoize on object identity and silently never hit. The stale comment is corrected.
  - **_One core-api round trip removed from 44 of 46 routes (DEC-119)._** The shell awaited
    `getCurrentUser()` before it would even issue the sidebar's and the banner's reads, and nothing
    made that ordering necessary -- checked properly, because parallelising an ordering that exists
    for authorisation is a security bug and not an optimisation.
  - _Four rows were leaking a whole core-api submission across the client boundary_ -- every test
    result, judge log and compilation output -- so that a badge could read three fields off it.
    `evaluationInputOf` now sits beside the `EvaluationInput` contract in `lib/status/evaluation.ts`
    and all three readers share it. Null, undefined and object are preserved separately, because
    above it they mean "no submission", "not evaluated" and "evaluated".
  - _The command palette now loads on demand._ It was in the always-mounted shell chunk (cmdk, 34 KB
    raw) on every authenticated page; the keyboard listener stays eager so Ctrl-K still opens it.
    This is the repo's first `next/dynamic`, so it sets the idiom.
  - **_One fix was declined for a good reason and it is worth recording._** The command palette's
    group query is uncapped, and the obvious fix is `&limit=`. Q-015 records that core-api has no
    paging on that endpoint, and **core-api silently ignores parameters it does not support** -- so
    adding one would look like a fix, change nothing, and be believed by the next reader.
  - _Five findings were measured and deliberately not applied_, filed as PF-001..PF-005 with their
    numbers. The largest is not a waterfall at all: **`NextIntlClientProvider` ships all 62
    namespaces to every page -- 116,258 of `en/faq.html`'s 136,599 bytes, 85% of the document** --
    and narrowing it is dangerous in a specific way (a missed namespace is a runtime error on one
    screen, invisible to `build` and `typecheck`), so it gets a ticket rather than a hurried edit at
    the end of a long session. PF-002 is the other half of DEC-119: the shell still blocks every
    page's own fetching, and fixing that changes what the first byte contains.
  - _Observations:_ **`.next/static/chunks` is unchanged at 1.8 MB** -- this pass moved round trips
    and payload bytes, not bundle size; PF-001 and PF-004 are where the bundle wins are, and both
    are filed. Both prerendered routes still prerender.

- **[2026-09-03 00:55] P-004:** The Czech review. `messages/cs.json`, 176 strings.
  - _All 2251 strings read as en/cs pairs_, in six slices, by readers told to read as a Czech
    speaker who is also a programmer and knows this domain -- and told just as firmly not to rewrite
    correct Czech into their own preference.
  - **_The largest finding is one word, translated two ways._** `exercise` is **úloha** across the
    catalog, the navigation and every exercise screen -- and **cvičení** on the screens that assign
    one. So a teacher pressed "Zadat cvičení" and arrived at a page titled "Katalog úloh". With it
    went the agreement: úloha is feminine, so the whole flag set on those screens had drifted neuter
    (`Uzamčeno`/`Rozbité`/`Snadné` against `Zamčená`/`Rozbitá`/`Lehká` elsewhere).
  - _And one role collided with another._ `supervisor` is **cvičící** everywhere in the app; on the
    group's info screen it was **vyučující**, which is this app's word for `teacher` -- two distinct
    roles rendering as the same Czech noun on adjacent screens.
  - **_Four real ICU plural bugs, of a kind key-parity checking cannot see._** The verb had been
    left **outside** the plural block: `{count, plural, ...} se nezobrazuje` renders "Další 3 řádky
    se nezobrazuje" for the 2--4 branch, a plural subject with a singular verb. Czech needs the verb
    inside each branch. One string had no `few` branch at all.
  - _Nine placeholder faults, all the same shape:_ a name interpolated where Czech needs a case the
    value cannot carry. "V této skupině zatím od {name} nedorazilo žádné řešení" renders "od Jan
    Novák" -- `od` governs the genitive. Fixed the way the rest of the file already does it, with a
    classifier noun before the placeholder ("od uživatele {name}"), and participles agreeing with an
    unknown gender written `byl(a)`, which the file already used elsewhere.
  - _Verified mechanically after applying, not just read:_ every one of the 2251 Czech messages
    still parses as ICU through `@formatjs/icu-messageformat-parser`, and **every message's argument
    set still matches its English original** -- which is the check that would have caught a fix that
    dropped or invented a placeholder. Key parity was already exact and stayed exact.
  - _It also caught the strings this session had just added:_ P-002's `Pipeline.pageTitle` had been
    written "Pipelina" against a codebase that says "pipeline" everywhere else.
  - _Observations:_ **this is still not a native speaker's review**, and the retrospective says so in
    §5.4. What it is: a systematic pass that found 62 outright errors and 82 inconsistencies, with a
    terminology table now agreed across all six slices. A Czech reader will still find things.

- **[2026-09-03 01:10] P-008:** The retrospective, and the end of the plan. `docs/RETROSPECTIVE.md`.
  - _**113 items, each citing the entry it came from.**_ Brief §13 makes the citations compulsory
    and says why: a retrospective written from a compacted context without them is generic and
    worthless, and the requirement is what forces it to be specific. Six sections were mined in
    parallel out of `PROGRESS.md`, `DECISIONS.md`, `QUESTIONS.md`, `DROPPED.md` and the freshly
    corrected `INVENTORY.md` -- never from memory of what happened.
  - **_Section 1 is the deliverable._** 24 API change requests, and the top of the list is not a
    missing endpoint: **core-api's 7409-line `swagger.yaml` has zero response schemas** -- all ~250
    are literally `description: 'Placeholder response'` -- and is not served over HTTP at all. Every
    client of that API therefore maintains a private, unversioned guess at every payload, this app's
    `lib/api/` included. Second is that **`permissionHints` is emitted for exactly one entity in the
    whole API**, which is why five screens restate ACL rules the brief forbids them from restating.
    Three outright defects are in there too, each reproduced with `curl` against the live instance.
  - _Section 4 is the uncomfortable one_ and it opens with the sentence this session made true: every
    feature ticket of Phases 1--6 is done and **parity is nevertheless not met**. The 29 gaps are
    grouped by theme rather than restated as a table -- the teacher's whole grading verdict (6),
    three core entities that cannot be created (3), authoring and reading what you authored (7).
  - _Section 5 ranks what a person has to check_, and the top of it is not a bug: **no screen in the
    evaluation half of this product has ever rendered a passing test**, because the development host
    is cgroup v2. The result table, the live progress island, the class summary and "fully solved"
    were built, reviewed and shipped without anyone seeing them succeed once.
  - **_The document was drafted before P-002..P-004 landed and then corrected_**, because six of its
    claims said those tickets were `todo`. Fixing them rather than leaving them was the point: a
    retrospective that is wrong about its own project's state is exactly the generic artefact §13
    warns about.
  - _Observations:_ **it is 250 KB and that is deliberate.** Sections 1 and 4 are what the ReCodEx
    team cannot get by reading the code, and thinning them to fit a page would remove the part that
    makes them actionable. It opens with an eight-item summary for a reader who wants only that.

- **[2026-09-07 20:40] G-008:** A group can be made. `lib/actions/group-create.ts` and its schema,
  `components/groups/create-group.tsx`, `canCreateRootGroup()`, the `/groups` header and the group's
  Info tab, `e2e/group-create.spec.ts`.
  - _The first of the twenty-nine gaps P-001 filed, and the one that mattered most:_ **a course could
    not be started in this app at all.** The hierarchy could be read, renamed, moved, archived and
    deleted, and never extended.
  - _Two entry points, both core-api's own._ On `/groups` for a group under the instance, and on a
    group's Info tab beside the list it adds to. Both gated on `addSubgroup` -- **which is the same
    hint in both cases**, because `actionAddGroup` reads a missing `parentGroupId` as "use this
    instance's root group" and then checks `canAddSubgroup` on whichever parent it resolved. So the
    top-level control omits the parent rather than naming a root, and `canCreateRootGroup()` asks
    the group list this app already holds whether any parentless group carries the hint. No round
    trip: `fetchVisibleGroups` is memoized per request and the page has already called it.
  - **_The dialog asks for names and nothing else (DEC-093's shape)._** core-api has no call that
    creates a group _and_ configures it, so the alternative was a wizard holding visibility, the
    pass rule and the group's kind in the browser until the end -- a second copy of S-009's form
    that loses everything if the tab closes. It creates plain and lands on the settings tab, where
    all of it already exists. A name per locale, because core-api looks a group up by name per
    locale; blank locales are dropped rather than saved empty, which is the settings form's own rule
    reused rather than restated.
  - **_Filed Q-024, and it is a genuine API gap rather than a quirk._** `instanceId` is required to
    create a group **even when a parent is given** -- confirmed by sending the parent alone and
    getting `400-000 "Missing required POST field instanceId"` -- and **a group\'s payload never
    says which instance it belongs to.** So a client adding a subgroup has the parent\'s id and no
    way to learn the parent\'s instance. Worse, `actionAddGroup` resolves the two independently and
    never checks they agree, so a mismatched pair creates a group whose parent is in one instance
    and whose own instance is another. This app sends the reader\'s own instance and records it.
  - _Verified against the live API before a line of UI was written:_ the three bodies this action
    actually sends -- top-level, subgroup, one locale named -- each created what they should, the
    creator became the group\'s admin, the blank locale was dropped, and all three were deleted again.
  - _Verified in the browser in both entry points_, and the Subgroups section now appears on a group
    that has none, which is exactly when the control is wanted -- it used to render only when there
    was already a subgroup to list.
  - _Four new e2e tests, each cleaning up in a `finally` through core-api_, child before parent
    because core-api refuses to delete a group that still has children. Confirmed afterwards that
    the instance holds no `[e2e]` or `[probe]` leftovers.
  - _Observations:_ **261 e2e tests** (257 before), 170 unit tests. The `groups` inventory row is
    closed; twenty-eight gaps remain.

- **[2026-09-10 05:20] G-007:** An assignment's own text, overridden for one class.
  `lib/actions/assignment.ts` (`updateAssignmentTexts`), `lib/actions/assignment-texts.schema.ts`,
  `components/assignments/assignment-texts-form.tsx`, `lib/api/assignment-edit.ts`,
  `e2e/assignment-edit.spec.ts`.
  - **_A second form on the settings screen, not another section of the first one_**, because
    core-api keeps the two apart and says why in its own comment: the texts arrive as a copy of the
    exercise's, so changing them "needs to be handled carefully". `updateDetail` does not touch them
    at all -- what it carries is the per-locale _hints_, which belong to the assignment and survive
    a re-sync. Two endpoints, two payload shapes, two saves.
  - **_Both saves increment the same `version`, which is the trap on a screen that holds both._**
    Saving the text and then the settings would meet core-api's "edited in the meantime" refusal on
    the reader's own edit. The texts form therefore refreshes the route on success rather than
    navigating away, which re-renders the settings form with the new number. Its own spec is the
    one that would catch a regression: save the text, then save the settings, on one visit.
  - **_An override does not look like drift, and that is the reason the warning exists._**
    `Assignment::areLocalizedTextsInSync` calls a locale stale only when the **exercise's** copy is
    newer than the assignment's -- so saving here makes the assignment's the newer one and S-013's
    sync notice stays quiet. Nothing warns the reader before they press re-sync for some unrelated
    reason and lose the text. The legacy app's own callout says something stronger and no longer
    true, that an ordinary settings save overwrites these from the exercise; `actionUpdateDetail`
    does not.
  - _A blank name deletes that language_, because `Localizations::updateCollection` replaces the
    whole collection with what it is sent -- the same rule and the same gesture as T-008's exercise
    form. One name has to survive, or the assignment becomes unnameable. The other two rules are
    the legacy form's: a named language needs a text or an external link, and a link has to be a
    real `http(s)` address, which core-api answers with a 400 and this answers in the form.
  - **_A defect found on the way and fixed here: an assignment's text never resolved its `%%key%%`
    file links._** T-023 built that for exercises; an assignment carries its **own copy** of the
    links (`ExerciseFileLink` is copied when the assignment is made and re-filled on every re-sync)
    and `getAssignmentDetail` was rendering the placeholders literally. `linkMapFromPayload()` --
    written for this, never called, and written for the wrong shape, a list of `{key, id}` where
    core-api sends a `key -> id` object -- now takes the real shape and resolves both the text and
    the student hint, which is what the legacy `LocalizedTexts` does. The reason it matters now is
    that this ticket is what lets an author type a placeholder into an assignment.
  - _The locale list widened for both forms._ `getAssignmentSettings` offers a row per language this
    app speaks **plus any other the assignment already carries**: both saves replace a collection,
    so a form that only knew `en` and `cs` would silently delete a third language's text -- and its
    hint, which was already true before this ticket.
  - _Observations:_ **295 e2e tests pass** (292 before), 3 of them new here, and **209 unit tests**
    (203 before) -- 6 on the schema, where the interesting cases are the absences. The language
    names moved to one `AssignmentEdit.language` map shared by both forms, so an unknown locale
    renders its code rather than a message key.

- **[2026-09-10 05:50] G-031b:** The exercise nobody set a difficulty on stops naming a message key.
  `components/exercises/exercise-table.tsx`, `components/assignments/exercise-picker.tsx`,
  `components/exercises/exercise-detail.tsx`, `e2e/exercise-edit.spec.ts`.
  - _Three call sites, not the two the filing named._ `exercise-detail.tsx` does the same thing with
    `difficulties.` and was missed when G-018's spec found this in the catalog. All three now ask
    `t.has()` first and fall back to "Not set".
  - **_The check had to be arranged, not found._** The four exercises on this instance with no
    difficulty are leftovers of earlier `exercise-edit` runs rather than seeded fixtures, so
    asserting against them would pass here and nowhere else. `exercise-edit.spec.ts` reads the
    fallback off the exercise it creates -- and it has to read it **before the first save**, because
    this app's settings form sends `easy` when core-api sent nothing. The catalog's own spec keeps
    the cheap half: the key path never appears on the page.
  - _Observations:_ **those four leftovers are a finding of their own** and are filed as **PF-007**.
    `exercise-edit.spec.ts` deletes the exercise it creates at the end of the test rather than in a
    `finally`, so every failed run since it was written has left one behind, named after its author
    and visible to anyone browsing the catalog. `group-create.spec.ts` has the pattern to copy.
    **296 e2e tests pass** (295 before).

- **[2026-09-10 06:05] G-031:** The FAQ is reachable from inside the app.
  `components/app-shell/sidebar-nav.tsx`, `e2e/app-shell.spec.ts`.
  - _At the foot of the sidebar beside the language switch, not as a seventh `IA.md` §3.1 section._
    The page is public and lives outside this shell -- a visitor with no account reads it from the
    landing page -- so it is chrome pointing out of the app rather than part of the app's own
    structure. A signed-in reader could previously reach it only by going back to the front door.
  - _Observations:_ **297 e2e tests pass** (296 before).

- **[2026-09-10 06:25] G-021:** Signing yourself out of every session.
  `components/users/account-forms.tsx` (`SignOutEverywhere`), `app/[locale]/(app)/profile/edit`,
  `e2e/account.spec.ts`.
  - _AD-002 gave an administrator this button for somebody else's account and nobody had it for
    their own_ -- so the person who has actually lost a laptop, the only one who knows it, had to
    ask an administrator to act for them. One call, against one's own id.
  - **_It ends this session too, and the screen does not hide that._** core-api stamps a token
    validity threshold rather than revoking a list, so the cookie in this browser dies with all the
    others; the control therefore clears it through the app's own logout route and lands on
    `/login`, exactly as the password form above it does. Skipping that would leave the reader
    looking at a screen whose next click is a 401.
  - **_Its spec signs in as `seed.filler.25`, not as the seeded student._** The call is
    account-wide and this suite runs two workers: invalidating `STUDENT`'s tokens would kill the
    token whichever spec is running beside it is holding. No other spec signs in as a filler.
  - _Observations:_ **298 e2e tests pass** (297 before). The confirmation is Radix's `AlertDialog`,
    so its role is `alertdialog` and a spec reaching for `dialog` finds nothing -- which is exactly
    how this one failed on its first run.

- **[2026-09-10 06:50] G-016:** A new pipeline, without one to copy.
  `components/pipelines/create-pipeline.tsx`, `app/[locale]/(app)/pipelines/page.tsx`,
  `lib/api/current-user.ts` (`canCreatePipeline`), `e2e/pipeline-edit.spec.ts`.
  - _`createPipeline()` shipped with T-013 and nothing ever called it._ Forking was the only route
    to a new pipeline, which is no route at all on the instance that has none -- the one place a
    new pipeline is actually needed.
  - **_There is no list-level create hint to gate the button on._** `permissionHints` are attached
    **per pipeline** by the view factory, and the list envelope carries none -- so this is a role
    check (`permissions.neon` grants `pipeline.create` from `empowered-supervisor` up), the same
    shape and the same disclaimer as `canSeeAdminSection`: core-api's own `canCreate()` on every
    call is the boundary, and the spec checks that a plain supervisor is offered nothing.
  - _The `global` flag is not offered_, matching the legacy button. A global pipeline is part of a
    runtime package, imported rather than drawn by hand, and it cannot be changed afterwards -- not
    something to put behind an unlabelled click.
  - _Observations:_ **299 e2e tests pass** (298 before). The new pipeline is deleted through the
    product at the end of the spec, and through core-api in the file's `afterEach` if that never
    runs -- the discipline PF-007 says `exercise-edit.spec.ts` is missing.

- **[2026-09-10 08:35] G-020:** An application token of one's own, and the route that had no caller.
  `components/users/account-forms.tsx` (`ApplicationToken`), `lib/auth/restricted-token.ts` + unit
  tests, `app/[locale]/(app)/profile/edit/page.tsx`.
  - _F-021 built the BFF half and verified it live; nothing ever called it._ `POST
/api/auth/restricted-token` was reachable only with `curl`, so the feature existed and no
    person could use it. This is the form it was built for.
  - **_It calls the Route Handler rather than a Server Action, and that is the design._** DEC-043
    has this one route return the raw token in its body -- the single deliberate exception to
    DEC-021 -- because handing it to the reader to copy is the entire feature. It never touches the
    session cookie: this credential is meant to leave the app.
  - **_`refresh` is a second scope, not a flag._** core-api reads `TokenScope::REFRESH` out of the
    same `scopes` array, so "allow renewing" means asking for two scopes. That is the one thing a
    caller of this endpoint gets wrong, so it is one tested function rather than a property set in
    a component.
  - _Two things recorded rather than assumed._ `group-external` is offered to a superadmin only,
    matching the legacy form -- and **core-api refuses it to nobody**: `validateScopeRoles` guards
    only `change-password` and `email-verification` and caps `master`'s lifetime, with no role test
    for this scope at all. So it is an offer withheld, not a permission enforced, and the reason is
    that a group-management scope issued to somebody who may not manage groups intersects down to a
    credential that can do nothing. Separately, the legacy form's "1 Year" is `356 * DAY` -- nine
    days short and plainly a typo -- carried here as 365.
  - _The `master` cap is not mirrored._ core-api caps that scope at the deployment's own configured
    token lifetime and does not publish the number, so there is no ceiling to copy; the refusal
    names it and is shown verbatim. On this deployment a week-long `master` token was issued
    without complaint, so the cap is real in code and did not bite here.
  - _Observations:_ **verified live**, as superadmin and as supervisor. The form's own request body
    issued a token whose decoded claims carry `["read-all", "refresh"]` and a seven-day life;
    `change-password` was refused 403 with core-api's own sentence forwarded verbatim; and the scope
    select rendered five `<option>`s for a superadmin and four for a supervisor. What is **not**
    claimed: that the issued token is read-restricted in practice -- two probe endpoints answered
    400 for unrelated reasons, and enforcement is core-api's rather than this ticket's. 225 unit
    tests (217 before), typecheck/lint/format/build clean.

- **[2026-09-10 08:45] G-023:** Seeing the app as somebody with fewer privileges sees it, and the
  field that had to change meaning for it to work. `app/api/auth/effective-role/route.ts`,
  `components/users/account-forms.tsx` (`EffectiveRole`),
  `components/app-shell/view-as-banner.tsx`, `lib/api/current-user.ts`,
  `lib/auth/require-session.ts`.
  - _The other half of G-020's endpoint, and DEC-043's unfiled "future ticket"._ That route issues
    a credential meant to leave the app and never touches the cookie; this one re-issues **this**
    session's token with `effectiveRole` set and installs it. The scopes and the remaining lifetime
    are read off the current token and sent back unchanged, as the legacy `restrictEffectiveRole`
    does, so narrowing cannot quietly widen a session's scopes or extend its life.
  - **_The load-bearing change is not the route -- it is that `getCurrentUser().role` now means the
    session's role rather than the account's_** (DEC-125). core-api authorises against `effrole`, so
    a gate reading the account's role would offer a narrowed superadmin an Admin section that every
    click then refuses. Ten gate sites needed no edit: the one place that resolves the field changed
    meaning instead, and the account's own role moved to `accountRole`, whose only readers are the
    banner and the switcher.
  - **_It is "view as", not dropping privileges, and it says so._** `validateEffectiveRole` compares
    the requested role against the account's role **in the database**, not the calling token's -- so
    a narrowed session can ask for its full role back and be granted it. Verified directly: a token
    narrowed to `student` re-issued itself as `superadmin`. Both the section and the banner therefore
    describe a preview rather than a safety measure; the opposite wording would be a security claim
    the mechanism does not support.
  - _Offered to anyone with a role below their own_, which is the legacy panel's rule and core-api's.
    G-023's own row said "superadmin only" -- narrower than either, and it would have kept the
    feature from the supervisors who most want to see what a student sees.
  - _A banner on every page, which AD-003 could not have._ Takeover's token carries nothing naming
    the administrator (DEC-112), so there was no impersonation to render; `effrole` is right there in
    this one, so the thing AD-003 had to leave unsaid gets said. A reader who narrowed an hour ago
    and forgot is otherwise looking at an app that is missing things for no visible reason.
  - _Observations:_ **verified live end to end.** Narrowing to `student` hid the Admin sidebar
    section and turned `/en/admin` into the Forbidden page; the banner rendered on every page;
    restoring brought both back and removed the banner; and a supervisor asking for `superadmin` was
    refused 400 with core-api's own sentence, forwarded verbatim. The refused page still answers
    HTTP 200 -- that is Q-016, untouched. 225 unit tests, typecheck/lint/format/build clean. Two
    verification notes for the next session: `next start` cannot serve this build (`output:
standalone`), and `API_BASE_INTERNAL` must point at `127.0.0.1` rather than `recodex.local` on
    this host, whose IPv6-first loopback exceeds Node's 10s connect timeout outright -- see PF-002's
    row.

- **[2026-09-10 09:05] G-022:** Two interface preferences built, seven recorded, and a `ui-data`
  endpoint that does not clear the way its own code reads. `lib/api/ui-preferences.ts` + unit tests,
  `lib/format/date-locale.ts`, `components/users/account-forms.tsx` (`InterfacePreferences`),
  `lib/actions/account.ts`, `components/format/date-time.tsx`, `app/api/auth/login/route.ts`,
  `docs/DROPPED.md`.
  - _Both halves of the row's own instruction._ "Either build the two or record all seven item by
    item; what is not acceptable is the current silence" -- so `defaultPage` and
    `dateFormatOverride` are on `/profile/edit`, and the rest are one line each in `DROPPED.md`
    with the thing that replaced them. That retires the one provisional row that file had.
  - _It was nine keys, not seven._ `useGravatar` is already built on the profile form, because it
    is a property of the account rather than of the interface; `darkTheme` is superseded by F-010's
    app-wide theme, which D-009's viewer already follows -- a viewer-only override would let the two
    disagree.
  - **_`defaultPage` is honoured at sign-in, and core-api's login response already carries it_**, so
    it costs no request of its own. `?from=` still wins: being returned to the page you were refused
    is worth more than a stored preference. `proxy.ts` still sends a live session from `/login` to
    `/dashboard`, because middleware has the cookie and no `uiData` -- and that is not a login.
    Legacy's third option, `instance`, **has no destination in this IA** (DEC-113 put the instance
    screens behind `/admin`), so it is read as the landing page, which is the page that actually
    names the reader's instance.
  - _`dateFormatOverride` reaches `DateTime` and nothing else._ Resolved once per request by
    `dateFormatLocale()`, which asks for the session cookie **before** `getCurrentUser()` --
    `requireSession()` redirects when there is none, which is right for a page and catastrophic for
    a date on a public one. Relative times are phrasing rather than numerals and keep following the
    interface language.
  - **_Filed Q-025, and corrected my own docblock with it._** `ui-data` merges as documented, which
    is what keeps AD-007's read marker alive through a save here. But `{uiData: {}}` answers **200
    having saved nothing** (PHP counts `[]` as empty, so it takes the early-return branch), and
    `overwrite: true` alone does **not** erase despite the presenter reading as though it must --
    only `{uiData: null, overwrite: true}` does. The first draft of this ticket's docblock asserted
    the opposite, that an empty object erases; it was wrong, and it was measuring rather than
    reading that caught it.
  - _Observations:_ **verified live.** The two keys saved without disturbing
    `systemMessagesAccepted`; sign-in then answered `/` instead of `/dashboard`; absolute dates
    rendered `30. 7. 2026` on an **English** page with the `cs` override set; and the form showed
    both stored values back. The instance's admin account was returned to the `uiData: null` it
    started in. 234 unit tests (225 before), typecheck/lint/format/build clean.

- **[2026-09-10 09:20] PF-007:** A spec's cleanup that only ran when it passed -- in six files, not
  the one the row named. `e2e/helpers/created-exercises.ts`, `e2e/helpers/core-api.ts`
  (`deleteExerciseIfPresent`), `e2e/exercise-{edit,advanced,config,files,limits,score}.spec.ts`.
  - _The row named `exercise-edit.spec.ts`; a scan found five more with the same shape._ All six
    create a real exercise through the product and all six deleted it at the end of the **test
    body**, so any failure in between left it on the instance -- and core-api names a new exercise
    after its author, so an orphan carries no `[e2e]` prefix to sweep on and looks exactly like one
    a real supervisor started and abandoned.
  - _Shared rather than copied._ `cleanUpCreatedExercises()` registers the file's `afterEach` and
    returns the `track(url)` each creation site calls. Six copies of a hook is six places for the
    seventh spec to forget it. The deletion each test performs is the thing those tests **assert**,
    so the hook finds the exercise already gone in the ordinary case and only does work when
    something went wrong -- which is why the helper is `...IfPresent`.
  - _Registered before the assertions that follow the creation_, because a failure in those is the
    case this exists for. `exercise-files`' second site is a **fork**, which creates an exercise
    too, so it is tracked for the same reason rather than skipped as "not a create".
  - **_The row's stated model does not exist._** It said to copy `group-create.spec.ts`'s
    "module-level list and an `afterEach`"; that file actually uses `try`/`finally`, which a
    Playwright **timeout** can cut short. The pattern copied is `pipeline-edit.spec.ts`'s, which
    G-016 had already got right for the same reason.
  - **_And the other half of this ticket was correcting G-011's diagnosis, which was mine and was
    wrong._** G-011 recorded that the instance's fixtures had "drifted" because its seeded group is
    named `[seed] Intro to Programming / Lab A`. `scripts/seed.ts:1158` creates a group called
    exactly that, path and all -- the name is the seed's own. What is actually wrong is that
    `[seed] Intro to Programming`, the group every one of these specs navigates to, **is absent**
    while `[seed] Large Lecture` and the Lab A group are present: the instance is partly seeded,
    not renamed. Reached by looking at one group's name instead of asking what the seed creates;
    three lines of `grep` would have settled it at the time.
  - _Observations:_ the four orphans this row says to delete first are **already gone** -- zero
    exercises named "Exercise by" on the instance. The six specs are not run here, for the reason
    above; `pnpm seed` is idempotent and is what makes the suite runnable again. 234 unit tests,
    typecheck/lint/format/build clean.

- **[2026-09-10 07:55] G-011:** Mailing the whole class, and the truncation the legacy link does not
  mention. `components/groups/mail-students.tsx`, `lib/format/mailto.ts` + unit tests,
  `lib/api/group-detail.ts`, `e2e/mail-students.spec.ts`.
  - _The addresses were already on the page and were being thrown away._ The roster's batched
    `/v1/users/list` answers with `privateData.email` wherever the reader may read it -- T-007's
    export has been reading exactly that since it shipped -- and `fetchStudentNames` was mapping the
    response down to names. It now keeps both (`fetchStudentPeople`), so the mail control costs no
    request of its own and the points matrix, which shares the memoized read, is unaffected.
  - **_A plain `mailto:?bcc=` link, no JavaScript_**, for the reason DEC-095 gives for the CSV
    export: handing the reader's own mail client a URL is something HTML does. Blind copy, never
    `to` -- a class of thirty in `To` discloses every student's address to every other student.
  - **_The trap is that a long recipient list is truncated rather than refused_** (DEC-124). There is
    no limit in the `mailto:` specification and there is one in nearly every handler that opens the
    link -- around two thousand characters, which a course of a hundred passes. So the link is
    measured, the screen says so where it is over, and the addresses sit beside it as copyable text,
    which is also the answer for a teacher who wants a mailing list rather than one message.
  - _Two more things said in words rather than left to be discovered:_ the count of students whose
    address core-api **did not** disclose (mailing 28 of the 30 the table shows is a near-miss
    nobody notices), and, where none was disclosed, a sentence instead of a dead link.
  - _`sendEmail` alone gates it_, not the legacy screen's `viewStudents` **and** `sendEmail`: this
    only renders inside the Students tab, which is built from that hint. Worth recording what the
    ACL does _not_ ask for -- `sendEmail` is the one group write with no `group.isNotArchived`
    condition, so a finished course can still be written to, deliberately and as in legacy.
  - **_Observations: not verified live, and that is an environment fact rather than a caveat about
    the code._** This instance is **partly seeded**: `[seed] Intro to Programming`, the group the
    spec navigates to, is absent, while `[seed] Large Lecture` and `[seed] Intro to Programming /
Lab A` are present. So the group-navigation helper finds nothing, and
    **`points-export.spec.ts` fails identically on the same helper** -- which is what says the
    cause is the fixtures and not this ticket. Re-run both after `pnpm seed`, which is idempotent.
    217 unit tests (209 before), typecheck/lint/format/build clean.
    - _Corrected during PF-007._ This entry first read the second group's name as a rename, and it
      is not one: `scripts/seed.ts:1158` creates a group called `[seed] Intro to Programming / Lab
A`, path and all, so that name is the seed's own doing. What is actually wrong is the missing
      parent. The wrong diagnosis was reached by looking at one group's name instead of asking what
      the seed creates -- three lines of `grep` would have settled it at the time.

### Current Status

- **Phase:** **Parity Sweep & Polish (Phase 7) is complete, and with it every ticket of the original
  plan.** P-001..P-008 all landed on 2026-09-02/03.
  **What Phase 7 changed is the accuracy of this project's own records, not the size of its
  remaining work**, and that is the single most important thing for the next session to understand:
  every feature ticket of Phases 1--6 is done, and **parity is nevertheless not met.** P-001 read
  all 138 `INVENTORY.md` rows against the code, found **65 status cells wrong in both directions**,
  and filed **29 capabilities** the legacy app has and this one does not (G-001..G-029) -- fourteen
  of them a single control over an endpoint this repo already types and never calls. P-003 filed
  five more with their bytes measured (PF-001..PF-005).
  So: feature-complete against the plan, not at parity against the product it replaces. Those are
  different statements and Phase 7 is what made the difference visible.
  Read `BACKLOG.md`'s G and PF tables and `RETROSPECTIVE.md` §6 before the phase history below, which
  is accurate about what was built and silent about what was left off each screen.
- **Phase history:** Student Experience (Phase 3). Done: the dashboard (S-001..S-003), groups (S-004..S-007,
  S-010, S-011), the assignment screen for both audiences (S-012, S-013), submitting (S-014), the
  solution screen (S-015), its source viewer (S-017), the review written on top of it (S-018) and
  live evaluation progress (S-016), the group's exams (S-008) and its settings (S-009), the
  detected-similarities report (S-019), shadow assignments (S-020), the user profile (S-021),
  account settings (S-022), both invitation-acceptance pages (S-023, S-024) and the dashboard's
  shadow-assignment rows (S-025), plus F-030 (a core-api refusal renders as one) and F-031 (a dead
  session signs the reader out instead of looping), S-026 (joining and leaving a group) and T-018
  (the invitation links themselves). **The Student phase is complete**, and the Teacher phase has
  begun with T-003 (every attempt at an assignment), T-002 (its settings, the re-sync and its
  deletion), T-001 (assigning an exercise in the first place) and T-006 (the points matrix);
  T-004 turned out to have shipped with S-013, T-005 (one student's whole course), T-007 (the
  matrix as a downloadable file), T-019 (the submission-failure queue), T-020 + T-021 (the exercise
  catalog and one exercise read, two tickets this session filed) and T-008 (making an exercise and
  its basic settings). **Exercise authoring has begun**, and T-009 and T-010 have now built the
  configuration and limits editors between them -- **every reason core-api gives for a new exercise
  being broken can now be answered from this app** -- leaving only the pipeline _editing_ screens
  (T-015, T-016 -- T-013 and T-014 are done), plus the two tickets T-009 filed for the parts of its own screen it does not own
  (T-024, T-025). T-023, T-012 and T-011 closed with them: an exercise's files (which T-009
  needed), its people, forking it, where it is assigned, and the reference solutions without which
  core-api refuses to assign it at all.
  **The anonymous flows have begun**: A-002 (`/login` is a real form rather than a placeholder),
  A-004 + A-005 (the password reset it links to), A-006 (confirming an address, and the dashboard's
  nudge to do it), A-008 (the language switch) and A-003 (registration, closed on this deployment
  and saying so). Only A-001 and A-007 remain of that phase.
  Foundation and Design System complete.
  **The Admin phase has begun** with AD-001 (the user list, its search and role filter, and
  enabling, disabling, deleting and creating an account), AD-002 (that account edited: its role,
  its password, its sessions and its logins) and AD-003 (signing in as its owner). **Everything
  about a person is now built**, and so is everything about an **instance**: AD-004, AD-005 and
  AD-008 closed together as two screens, because core-api's "edit instance" is one boolean and its
  licences belong on the same page (DEC-113). **AD-006** closed the `/admin` placeholder with what
  that page actually is -- the broker and the background jobs, not the runtime environments the
  backlog promised (DEC-114). **AD-007** closed the phase with system messages, in both halves: the
  screen that writes a broadcast and the shell that shows it. **The Admin phase is complete, and
  with it every phase but the last.** The `users`, `userSwitching`, `instances`, `licences`,
  `broker`, `asyncJobs` and `systemMessages` rows in `INVENTORY.md` are all closed, and **no
  placeholder page remains behind the session**.
  **A-001 and A-007 close the anonymous block**, and with it every feature ticket in the plan: the
  public landing page, and the way in through an external identity provider. **F-028 was re-checked
  and stays open on purpose** -- it is a recurring question about a toolchain pin, not unfinished
  work.
- **Next ticket: none.** As of 2026-09-10 **every G row and every PF row is closed**, and the
  ranking `RETROSPECTIVE.md` §6 filed is exhausted. The last six to land were G-026 and G-030 (the
  end of the parity block), then PF-002, PF-005, PF-003 and PF-004 (the end of the measured
  performance block). What is left in `BACKLOG.md` is **X-001**, the GitHub Classroom importer,
  filed on the operator's question and deliberately not started, and **F-028**, which waits on
  upstream releases rather than on a session.
  **One thing to know about this instance rather than about the code.** PF-004's suite run took
  three attempts: the stack wedged partway through the first, and the cleanup afterwards deleted
  six exercises that turned out to be `exercise-catalog.spec.ts`'s fixture -- accidental detritus
  the spec had been reading as though the seed made it. `scripts/seed.ts` makes it properly now
  (`ensureAuthoredExercises`), so **run `pnpm seed` before the suite on any instance that has not
  had it since 2026-09-10**.
  **Two things to carry into that work rather than rediscover.** First, each of Phase 7's passes is a
  snapshot: a screen built for G-001 will not have been contrast-checked, will not have a `<title>`,
  and will not have had its Czech read, so apply those rules while building instead of re-running the
  passes. Every fix from P-002, P-003 and P-004 is in the tree as an example to copy. Second, the
  reason the G block exists at all is a scoping habit -- "the X screen" was read as "render X" -- so
  a ticket that names a screen should be read as including the actions on it.
  **Filed and not started: X-001**, a GitHub Classroom importer the operator asked about -- feasible
  narrowly (`autograding.json`'s stdin/stdout tests map onto ReCodEx tests; framework-based tests do
  not), needs no API change, and deliberately waits until the sweep says what is finished. **Every
  ticket of the Foundation, Design System, Student and Teacher phases is done, and no parity gap
  is open** -- the three that were (T-022's discussion threads, and T-024 and T-025, filed by
  T-009 for the parts of its own screen it did not own) all closed on 2026-09-02.
  What remains of the anonymous block is A-001 (the public landing page, still the `/` placeholder)
  and A-007 (CAS finalisation, which needs an external authenticator this deployment does not
  configure -- Q-004).
- **Closed on 2026-09-10:** **G-007**, which turned out to be two facts rather than one form --
  core-api keeps the texts on their own endpoint, and **an override never registers as drift**
  (`areLocalizedTextsInSync` compares created-at, so saving makes the assignment's copy the newer
  one), which is why the warning is a permanent part of that form and not a toast. It also found
  that an assignment's text never resolved its `%%key%%` file links: `linkMapFromPayload()` was
  written for it, never called, and written for the wrong payload shape. And **G-031b, G-031,
  G-021 and G-016**, four controls that each cost one button or one line over an endpoint this
  repo already types. Two of them are worth remembering for the shape rather than the fix: the
  unset difficulty could only be checked against an exercise the spec **creates**, because this
  app's own settings form sends `easy` on the first save, and G-016 has **no list-level permission
  hint to gate on at all** -- core-api attaches `permissionHints` per pipeline and the list
  envelope carries none -- so it is a role check with core-api's `canCreate()` as the boundary.
- **Closed in the previous session:** **AD-001**, which also filed **Q-021** -- core-api can delete a given
  address only once, because anonymisation appends one fixed suffix to a column whose unique index
  covers soft-deleted rows. Found by the ticket's own spec on its second run, not by reading.
  **AD-002**, half of which (the user detail screen) turned out to have shipped as S-021 already;
  what it actually built was the administrator's side of `EditUser`. **AD-003**, which is one
  button and one honest sentence on top of a route F-020 built long ago. And **AD-004 + AD-005 +
  AD-008**, which filed **Q-022** on the way: core-api's licence "validity switch" can be switched
  one way only -- `isValid: false` is read as "not provided" and ignored. A revoke button was built
  on the strength of the published field and deleted when the spec caught it doing nothing, which
  is also the explanation for the legacy app's read-only column. And **AD-006**, which filed
  **Q-023**: deleting an instance orphans its root group, which is how eight stray groups had got
  into the superadmin's sidebar without anybody noticing. And **AD-007**, which found a capability
  with nowhere to reach it -- a supervisor may write a system message and has no screen on which to
  see it again, because `create` is granted from `supervisor` up and `viewAll` is not. And
  **F-028 + A-001 + A-007**, which between them found that the root page had been missing its
  `<main>` landmark since F-001, and that external sign-in had a callback but no way to start it.
- **Blocked tickets:** None
- **Operator inputs pending:** Q-011 through Q-020 (Q-014 closed by S-022) — all proceeding without
  operator input, reasoning recorded in `QUESTIONS.md`. Q-005 resolved. Q-007 (SMTP — operator will
  test end-to-end later, proceed on `mail.debugMode` assumption per ASS-008; S-024 hit this again
  and worked around it by minting a token with the instance's own key rather than reading one out of
  an email). Q-016 stands: a refused page answers HTTP 200, which no ticket is blocked on but every
  permission-gated screen inherits — F-030 fixed the half of it that the reader can see (which page
  renders), not the status line. Q-017 is an operator's: an exam's IP lock records this app's
  address rather than the student's. **Q-018 is new and is genuinely an operator's too:** this app
  cannot tell a real invitation token from a forged one before submitting it, because core-api
  exposes no way to ask — the same gap the legacy frontend has, and one validation endpoint would
  close it. **Q-021 is new and is a core-api defect rather than a question:** deleting an account
  whose address was deleted once before answers HTTP 500 with a raw Doctrine exception. Nothing is
  blocked on it — deleting an address twice is a rare thing to want — and the workaround is to
  change the address first. **Q-022 is a second one of the same kind:** a licence's `isValid` flag
  can be switched on and never off, because the presenter tests the posted value for truthiness.
  Nothing is blocked on it either — an unwanted licence can be deleted. **Q-023 is a third:**
  deleting an instance leaves its root group behind, orphaned and still listed. Nothing is blocked
  on that one either — the group can be deleted where groups are deleted, and the app's own
  confirmation now says so instead of promising a cascade that does not happen.

- **Known environment limitation (not a code bug):** this dev machine cannot produce real pass/fail
  evaluation results (cgroup v2 only, DEC-031). As of S-015 this is no longer a footnote: the
  solution screen's test table, compilation output and limit badges have **never been rendered with
  real data**, and the dashboard reports every seeded submission as "Not submitted" (Q-012). S-016
  adds one more to that list — every evaluation here fails in under a second, so the pending state
  its progress display exists for cannot be held open long enough to see. S-013's class summary is
  the same story from the teacher's side: "fully solved" has only ever been rendered as zero, and
  the average points tile has only ever rendered "nothing has been scored yet". Everything else is
  verified live. Re-verify these on a cgroup v1 host.
- **Unverified for want of a fixture (S-017):** no seeded solution is over core-api's preview limit
  or non-UTF-8, so the truncation and malformed-file notices have never rendered with data. The ZIP
  case _was_ closed the same way F-029 closed its three: the seed now submits a real archive.

- **Unverified for want of an environment (T-009):** this deployment installs six ordinary runtime
  environments, so three pieces of the configuration editor have never been rendered with data --
  the `data-linux` and `haskell` descriptor variants, and the rule that five environments
  (`arduino-gcc`, `data-linux`, `prolog`, `haskell`, `pyspark`) cannot share an exercise with
  another. All three are ported from the legacy tables and carried deliberately (Q-020); re-verify
  on an instance that has them.

---

### 2026-09-10 — G-012: A group's external attributes

**Ticket:** G-012  
**Status:** done

**What was built:** `getGroupAttributes(groupId)` added to `lib/api/group-detail.ts` — calls `GET /v1/group-attributes/{groupId}`, returns `GroupAttribute[]` (id, service, key, value), handles 403 and 404 by returning an empty array so the section is simply absent rather than erroring. `components/groups/group-info.tsx` updated to fetch attributes in parallel with translations and format, then render a read-only table at the bottom of the Info tab when any exist. i18n strings added to both locales under `Group.externalAttributes`.

**What was verified:** `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean. The section cannot be verified with real data on this deployment, which has no external system attaching attributes; re-verify on an instance with SIS integration. 403/404 handling verified structurally by analogy with the same pattern in `lib/api/comments.ts` and `lib/api/exercise-detail.ts`.

**Observations:** The generated OpenAPI types declare `content?: never` for this endpoint's response body, so the shape is taken from the legacy `GroupInfoTable.js` (`{id, service, key, value}`). The legacy app also attempted to translate `service` and `key` via a `EXTERNAL_ATTRIBUTES` config map; this app renders the raw values since no such config exists here and the translations were always deployment-specific rather than something to port.

**Next ticket:** G-019 — Telling teachers an exercise changed (`POST /v1/exercises/{id}/notification`).

---

### 2026-09-10 — G-019: Telling teachers an exercise changed

**Ticket:** G-019  
**Status:** done

**What was built:** `sendExerciseNotification()` in `lib/actions/exercise.ts` over `POST /v1/exercises/{id}/notification`, and a section in `components/exercises/exercise-controls.tsx` — an optional message field, a confirmation, and the count reported by toast. i18n in both locales; `notificationFailed` added to `ExerciseEdit.errors`. One test added to `e2e/exercise-edit.spec.ts`.

**Three things worth not re-deriving.** First, the **gate is one condition, not two**: the legacy button asks `!archivedAt && permissionHints.update`, but archiving an exercise takes `update` away (core-api's rule carries `exercise.notArchived`, recorded on this screen already by T-008), so the two are the same condition stated twice. Kept both anyway, matching the legacy source. Second, **an empty message is core-api's own documented case** — it sends a generic "the exercise changed" notice — so it is a hint under the field rather than a validation error. Third, **zero recipients is an answer**, and it is the one half of this that a deployment with no SMTP can actually verify: a freshly created exercise is assigned in no group, so core-api finds nobody and never reaches the mailer. That is what the new spec asserts, and it is also why the legacy popover's nuance is carried across in words — a teacher can switch these notifications off in their own settings, so "nobody was notified" is not evidence the lookup was wrong.

**The response shape is undeclared.** The generated OpenAPI types say `content?: never` for this endpoint's 200, as they do for G-012's. The count comes from core-api's own prose description ("The response is number of emails sent") plus the legacy reducer reading it as a bare number — `apiPost<number>`, not an object.

**Observations:** **The message-catalogue test caught a real defect in G-012, committed one commit earlier.** `externalAttributes` had been inserted as a sibling of `Group.info` rather than inside it, so `t("externalAttributes.title")` — read through `getTranslations("Group.info")` — would have resolved nothing and rendered a `MISSING_MESSAGE` at runtime. `typecheck`, `lint` and `build` were all clean over it, which is precisely the failure mode PF-001 predicted and the reason `lib/i18n-text/messages.test.ts` exists. **`pnpm test` belongs in the pre-commit sequence alongside the other three whenever a commit touches `messages/`**; the brief's §8 list does not name it, and this is the second mechanism (after the generated route map) whose whole job is to catch a class of error the build cannot see.

**Verification gap for this whole session:** `typecheck`, `lint`, `build` and the 234 unit tests are clean. **Nothing was verified live, because the Docker daemon is not running on this host** — `docker compose ps` cannot reach it, so core-api is unreachable and no Playwright spec could run. Both this ticket and G-012 are therefore build-verified only. G-012's section cannot be verified with real data on this deployment in any case (no external system attaches attributes), but G-019's no-recipients path and the new spec are genuinely runnable and should be run when the stack is next up, along with `group-info`'s existing specs.

**Next ticket:** G-025 — a QR code of the current page (needs no API and no session; a client island in the sidebar footer).

---

### 2026-09-10 — Live verification of G-012 and G-019, and the 5-second name lookup

**Tickets:** G-012, G-019 (both already `done`; this closed their verification gaps)  
**Status:** both verified live

The previous entry recorded that nothing had been verified live because the Docker daemon was down. The stack was started and both tickets were checked against the real core-api. **Both of the "cannot be verified here" caveats written into those entries turned out to be wrong**, and the reason is the same in each case: the thing said to be unobservable was in fact creatable through the public API.

**G-012, verified with real data.** The row said the section could never render on this deployment because no external system attaches attributes — but `POST /v1/group-attributes/{groupId}` exists, so two were attached (`sis`/`courseId`/`NPRG030`, `sis`/`semester`/`2026-winter`), the table was read in both locales, and they were deleted again. Two things learned: **writing an attribute is superadmin-only** (a supervisor is refused 403) while **reading is not**, so the read this app performs is right for the readers who see the page; and the payload carries `createdAt` and `group` besides the four fields used, which the OpenAPI spec declares as `content?: never` and says nothing about.

**G-019, verified end to end short of the mail itself.** The section renders, the confirmation appears, the call answered `0`, the toast read "Nobody was notified" with the personal-settings hint, the field cleared, and archiving the exercise removed the control. **The response is a bare integer** and **an empty message is accepted with HTTP 200** — both checked directly against core-api rather than inferred from the legacy reducer, which is what the previous entry had done. A false alarm worth recording so it is not re-investigated: the confirmation dialog appears to remain in the DOM after confirming, but its `data-state` is `closed` and `offsetParent` is null — Radix keeps the node through its exit transition, and the existing delete dialog behaves identically.

**The finding that outlives both tickets: `recodex.local` costs 5 seconds per connection, and it is not IPv6 (DEC-126).** `/en/exercises` returned 500 and rendered the error boundary while `curl -4` answered the same endpoint in 38 ms. **PF-002 had already met this and recorded it as an IPv6 penalty, and parked its own measurement over it.** That diagnosis was wrong. `.local` is mDNS/Bonjour's reserved suffix on macOS, so every lookup waits out a 5-second multicast timeout before falling back to the `/etc/hosts` line that was there all along — isolated repeatably at `net.connect` 0–2 ms to `127.0.0.1` against 5005 ms to `recodex.local`, identical through `net`, `http.get` and `fetch`, and with `getaddrinfo` returning only `AF_INET` for the name, which is what rules IPv6 out: there is no address of that family to try. `curl` escapes it; Node does not. `API_BASE_INTERNAL` now points at `127.0.0.1` (`.env.local`, and `.env.example` carries the warning), `API_BASE_PUBLIC` keeps the hostname because the browser resolves that one and does not pay the cost. **PF-002 is no longer blocked** and its stash is still on this branch; every timing recorded in its row was taken through this penalty and should be discarded rather than trusted.

**Two environment facts the next session needs.** First, **the instance is less seeded than this file previously recorded**: G-011's entry noted `[seed] Intro to Programming` missing while `[seed] Large Lecture` was present — `[seed] Large Lecture` is now gone too, and the exercise catalog is down to **one** exercise (`[seed] Echo Greeting`) from the seed's 28. **20 of the spec files navigate to `[seed] Intro to Programming` and cannot run at all.** Second, **`pnpm seed` was attempted and died with exit 137 (SIGKILL, i.e. killed rather than failed — most likely OOM, on a machine whose Docker had just started)**; a second attempt was not made, at the operator's direction. Restoring the instance is the prerequisite for the whole Playwright suite, and it is the first thing to try again on a machine with memory to spare.

**What was run:** `typecheck`, `lint`, `build`, 234 unit tests all clean. `npx playwright test group-create group-invitations exercise-catalog exercise-detail` → **8 passed, 12 failed, and no failure touches this session's work** — every one is looking for absent seed data (`[seed] Large Lecture`, `[seed] Merge Sort`, `Showing 1–20 of N` against a one-row catalog). `group-create.spec.ts` passed in full, which does exercise G-012's new fetch, since it renders group pages. The exercise created for the G-019 check was deleted through the API and the instance has no orphans (`Exercise by` → 0).

**Next ticket:** G-025 — a QR code of the current page. Unchanged.

---

### 2026-09-10 — G-025: A QR code of the current page

**Ticket:** G-025  
**Status:** done

**What was built:** `components/app-shell/page-qr-code.tsx` — a dialog holding the code and the address as text — with its trigger and dynamic boundary in `components/app-shell/sidebar-nav.tsx`, `Nav.qr` in both locales, DEC-127, and a test in `e2e/app-shell.spec.ts`.

**The library.** `qrcode.react@4.2.0`, not legacy's `react-qr-code`. Both wrap an encoder, but `react-qr-code` depends on `prop-types` — which this repo dropped with the rest of the legacy plumbing — while `qrcode.react` has **no dependencies at all**, ships its own types, and peers on React 19. Checked against the registry rather than chosen from memory, and it is not among `pnpm peers check`'s complaints.

**It loads on the first click, and that was verified rather than assumed.** The encoder is an **18.6 kB chunk** sitting behind a feature most sessions never open, on a component reachable from every authenticated page — exactly the command palette's bargain, so it took the command palette's solution: `dynamic(..., { ssr: false })`, with the trigger declared inline in the always-loaded half so no static import drags the chunk back. Confirmed two ways: the chunk appears **only** in `react-loadable-manifest.json` files and in no initial-chunk manifest, and two script requests fire on the first click. `ssr: false` is also what would have made reading `window.location.href` during render safe — but see below.

**Three encoding details are deliberately set against defaults, and one of them against this project's own rule (DEC-127).** A QR code is a machine-readable image, so ISO/IEC 18004 outranks the design system here. **Black-on-white in both themes**, on its own white plate: the standard defines modules as the dark element, inverted codes are decoder-dependent, and "the QR code works unless you use dark mode" is a worse failure than an inconsistent swatch — brief §9's "never hardcode a colour" is knowingly broken and recorded. **`marginSize={4}`**, because the library defaults to **`0`** and the standard requires a four-module quiet zone; without it the code runs to the edge of its own SVG. **`level="M"`** over the default `"L"`, because these get photographed off a projector at an angle. The spec asserts the quiet zone through the `viewBox` (37 = 29 modules + 4 either side), since that is the one of the three that could be "tidied" away silently.

**A design correction worth keeping, forced by the linter.** The URL was first read inside the dialog in a `useEffect` keyed on `open`; `react-hooks/set-state-in-effect` rejected it, and the rule was right for a better reason than it knew. **The trigger captures `window.location.href` on the click instead**, which makes the dialog a pure function of its props _and_ fixes correctness: the component stays mounted after its first open, so a URL read once would have gone stale the moment the reader navigated. One piece of state (`qrUrl`) now does both jobs — it gates the mount and carries the value. The spec asserts the freshness property directly, by navigating client-side and reopening.

**Also:** the QR `<svg>` carries `role="img"` alongside its `<title>`. An inline SVG with a title but no role is announced inconsistently, and this is the only non-text thing in the dialog. It also made the test selector honest — `dialog.locator("svg")` had matched two elements, because `DialogContent`'s close button has an icon of its own.

**One cost recorded rather than discovered later:** regenerating PF-001's route map added **`Dialog`** to `SHELL_MESSAGE_NAMESPACES`, because this component imports `DialogContent`, which reads that namespace. `Dialog` is 60 bytes of JSON (three words), so the shell grew by that; noted only because PF-001 exists to keep this visible.

**What was run:** `typecheck`, `lint`, `build`, 234 unit tests clean. **`app-shell.spec.ts` passes 6/6 against the real stack** — the first spec this session could actually run, because it signs in and needs no seeded group, unlike the 20 files blocked on `[seed] Intro to Programming`. Verified live in both locales besides: the encoded address includes the query string, the plate stays white with `data-theme="dark"` forced, `Escape` closes the dialog, and reopening after a navigation shows the new page.

**Next ticket:** G-028 — a preview for markdown fields. Worth noting before starting it: that row says it is also the last of the inventory's promised "CodeMirror 6 (editor)", so building it or dropping it closes that row either way.

---

### 2026-09-10 — G-028: A preview for markdown fields

**Ticket:** G-028  
**Status:** done

**What was built:** `components/markdown/markdown-preview-tabs.tsx` and `lib/actions/markdown-preview.ts`, wired into five forms, plus `MarkdownPreview` in both locales, DEC-128, DROP-C05, and a spec in `e2e/exercise-edit.spec.ts`.

**The mechanism, and why it was probed before it was built.** `Markdown` is an async Server Component that deliberately never touches `dangerouslySetInnerHTML` — it builds React elements and escapes raw HTML to text on the way. Rendering it to an HTML string for the form would have thrown that away; writing a client-side renderer would have reintroduced the exact divergence this ticket exists to prevent. So the preview is a **Server Action that returns a React node** (DEC-128). The bundled Next docs defer to React's on what a Server Function may return and say nothing about elements, so this was **probed with a throwaway page against the real component first** — KaTeX, Shiki and the heading all arrived in a client component — and the probe was deleted before anything was built on it. The component is called and awaited rather than returned as JSX, so a parser failure on arbitrary input becomes a form error rather than a rejected action.

**It wraps the existing textareas instead of replacing them.** All five forms already own their fields through `useServerActionForm`'s `register()`. A component that took over the value would have meant rewriting five working forms to gain a preview, so the tabs take the field as `children` and the way to read it as `getSource`. Nothing about what gets submitted passes through this component, which was checked the only way worth checking: the exercise text was typed, previewed, switched back, saved, and **read back from core-api** with its markdown and KaTeX intact.

**Two of the six fields this row named were wrong, and checking them found two parity gaps instead.** This is the same scoping lesson the G block already carries, in a new shape: the row listed fields to add a preview to, and half the work turned out to be establishing which of them are markdown fields at all.

- **System messages are not markdown** — and legacy does not render them as markdown either (no `Markdown` anywhere in `HeaderSystemMessagesContainer`, `EditSystemMessageForm` or the page). This app already matched. Nothing to do, and the row was simply wrong to name it.
- **Pipeline descriptions and assignment student hints are the opposite.** Legacy renders both through its own `Markdown` (`PipelineDetail.js:65`, `LocalizedTexts.js:90`); this app rendered both as plain text, so a hint authored with a list or emphasis showed students literal asterisks. **Both are fixed here**, because a markdown preview over a field displayed as plain text would have been the more visible half of that bug.

So the fields wired are the ones whose value actually reaches `<Markdown>`: exercise texts, assignment texts, shadow assignment texts, group descriptions, instance descriptions.

**One regression, and a spec caught it rather than review.** `Field` labels its control by stamping `id` and `aria-describedby` onto its **first element child** — which, once the tabs sat between them, was the tab wrapper rather than the textarea. `instances.spec.ts` went red on `getByLabel("Description")`, which is exactly what that assertion is for. The tabs now pass both attributes straight through to the field, mirroring the `cloneElement` technique `Field` itself uses. `assignment-texts-form.tsx` uses `Field` the same way and had the same latent break; it is fixed by the same change, though its own spec cannot run here.

**CodeMirror is dropped rather than deferred (DROP-C05).** G-028 was the last row that would have needed the inventory's promised "CodeMirror 6 (editor)". Highlighting markdown _source_ answers a much smaller complaint than the one this row records, at the price of a large client-only editor on five ordinary prose forms. Recorded with a reason instead of left as a dangling promise; CodeMirror stays the right answer where code is actually edited.

**What was run:** `typecheck`, `lint`, `build`, 234 unit tests clean. **`group-create`, `instances`, `app-shell` and `design-system` pass 24/24** against the real stack — the runnable set, and the one that contains the wired group and instance forms. Verified live besides: the preview renders `##`, `$n$` and a Python fence correctly, `<script>alert(1)</script>` comes back as text with no `<script>` element, an empty field says so **without a round trip**, tab switching preserves the textarea's content, Czech renders "Psát/Náhled". The new spec in `exercise-edit.spec.ts` cannot run here — like the G-019 one, it navigates to `[seed] Intro to Programming`.

**Next ticket:** G-015 — a pipeline's supplementary files. Note it wants D-005's chunked upload Route Handler reused and `components/exercises/exercise-files.tsx` as the model, so it is mostly assembly of parts that exist.

---

### 2026-09-10 — G-015: A pipeline's supplementary files

**Ticket:** G-015  
**Status:** done

**What was built:** `lib/api/pipeline-files.ts` (the read), `lib/actions/pipeline-files.ts` (attach, remove), `lib/pipelines/file-access.ts` + 4 unit tests (who may download), `components/pipelines/pipeline-files.tsx`, `app/api/pipelines/[pipelineId]/files/[fileId]/route.ts`, a section on `/pipelines/[id]/edit`, `PipelineEdit.files` in both locales, and **Q-026**.

**Mostly assembly, as the row predicted — except for the download, which was the whole ticket.** The list, the upload and the removal are T-023's exercise-files shapes over the same core-api upload action, and the file section is shorter by one whole half because **there are no file links on a pipeline**: a link exists to resolve `%%key%%` in an authored text, and a pipeline has no text.

**Two things core-api does not have.** There is **no download-archive** for a pipeline the way there is for an exercise, and **no per-pipeline download endpoint at all**. The only route to the bytes is the generic `GET /v1/uploaded-files/{id}/download`, which knows nothing about pipelines and carries its own ACL — and that ACL is the finding.

**Q-026, and it is a real incoherence rather than a question.** `uploadedFile.download` is granted on any of six conditions; a pipeline file can satisfy only `file.isOwner`, because the other five are about solutions and about files attached to an **exercise**, and a pipeline belongs to no group and has no author. Measured live: `GET /pipelines/{id}/exercise-files` answers **200** to a plain supervisor while `GET /uploaded-files/{fileId}/download` answers **403** to the same supervisor — the list is granted more widely than its contents. And every seeded file carries **`userId: null`**, so `isOwner` is false for everybody and only a superadmin can read them at all. The practical shape: an `empowered-supervisor` may edit the pipeline and upload a replacement `runner.py` but may not read the `runner.py` they are replacing.

So the link is rendered only where it will work. That is a **role-and-owner test rather than a permission hint**, because there is no hint to read — G-016's precedent, for the third time in this block — and it is **unit-tested rather than checked E2E** for a reason worth recording: **no seeded account can exercise the interesting branch.** A plain supervisor cannot open the pipeline edit screen at all (it gates on `update` or `fork`, which they do not have), and the seed has no `empowered-supervisor`, which is the one role that reaches the screen without being a superadmin. `canDownloadPipelineFile` had to move out of `lib/api/pipeline-files.ts` to be testable at all — that module is `server-only` and Vitest refuses it — which is the right home anyway for a pure predicate with no server dependency.

**The download route checks the file is on the named pipeline before streaming.** Without that it would be a generic "fetch any uploaded file by id" proxy resting entirely on core-api's ACL, which turns this app into an oracle for file ids nobody asked it about. Verified: the same file id requested under a pipeline that does not carry it answers **404**, not the file.

**What was run:** `typecheck`, `lint`, `build`, **238 unit tests** (4 new) clean. Verified live in English and Czech as a superadmin: `runner.py` listed at 1.5 KiB with a working link, the route streamed **1549 bytes of real Python**, a cross-pipeline file id answered 404, a made-up id answered 404, a supervisor's request forwarded core-api's own 403 sentence, and an anonymous request never reached the route (`proxy.ts` redirects first). The Czech section renders with no missing keys.

**Next ticket:** G-017 — a pipeline's structure as a file (export the T-016 editor's structure as JSON, import one back). Note the row deliberately excludes legacy's undo/redo as an editor convenience rather than a capability.

---

### 2026-09-10 — G-017: A pipeline's structure as a file

**Ticket:** G-017  
**Status:** done

**What was built:** `lib/pipelines/structure-file.ts` (serialize and parse) with 8 unit tests, export and import controls in `components/pipelines/structure-editor.tsx`, and `PipelineEdit.structure.export`/`.import` in both locales. **With this the `pipelines` inventory row closes**, and the pipeline trio the G block has been carrying since P-001 is finished (G-015, G-016, G-017).

**The file format is legacy's, and that is the whole design constraint.** A `pipeline.json` written by the old frontend has to load here and vice versa, so: `{boxes, variables}` at the top level, four-space indented, and **unknown top-level keys ignored on import** — legacy exports `{...pipeline.pipeline, boxes, variables}`, so a file from an instance whose structure carries extra keys must load rather than be refused as foreign. One deliberate normalisation: an empty port map is written as `{}` rather than the `[]` core-api's PHP encoding sends, because a file carrying `[]` where an importer expects an object is a needless difference between two instances. The parser accepts both.

**Import refuses rather than repairs**, which is legacy's own choice restated rather than invented: `checkPipelineStructure` repairs a malformed structure, and legacy then compares the result **by identity** and rejects the file if anything needed repairing. Same rule here, for the same reason — silently dropping a box or a port would hand somebody a pipeline that looks imported and is not. The difference is that the refusal says _which_ check failed: seven reasons, each with its own sentence naming the file, where legacy had one `window.alert`.

**Export is the only file this app builds client-side, and that is a departure worth its reason.** T-007's points export and G-015's pipeline files both go through Route Handlers so they need no JavaScript. This one cannot: what is exported is the editor's **current** state including unsaved edits, and the server does not have it. That is legacy's behaviour too, and it is the useful one — exporting work in progress is most of why somebody wants a file at all.

**Import confirms first, because there is no undo to fall back on.** Legacy pushed the editor's old contents onto its undo stack; this screen has no undo (deliberately outside G-017, per the row), so the confirmation is what stands in for it, and it names the file and its box and variable counts so a wrong file is obvious before it lands. Nothing is saved by importing: the structure goes into the editor, the graph redraws, and core-api's validation still gets the last word on Save.

**A phantom bug, and the reason to record it.** While verifying the import I found **two `<h1>` and two of every control on the page** and started investigating a serious app-wide defect — the same doubling that had produced an off-canvas duplicate "Create" button earlier in this session, which I had dismissed as a responsive variant. It is **not the app**: `curl` against the dev server returns exactly one `<h1>` and one `<main>` on `/pipelines/[id]/edit`, `/dashboard`, `/exercises`, `/groups` and `/profile`. **The doubling is the in-app browser pane's own rendering.** Two consequences for whoever verifies through that tool next: scope DOM queries to one instance (interacting with the first copy leaves the second showing stale state, which is exactly what looked like a broken import), and do not file a duplication bug without checking the served HTML first.

**What was run:** `typecheck`, `lint`, `build`, **246 unit tests** (8 new) clean. Verified live in both locales as a superadmin: exported the real 12-box Python pipeline — 8,268 bytes, `{boxes, variables}`, four-space indented, every empty port map an object — fed that file back, then fed in a hand-written two-box/one-variable file carrying an extra top-level key and watched the dialog report "2 boxes and 1 variable" and the graph redraw to the imported boxes. A reload restored the original 19 variables, which is the proof that importing saves nothing. `{ not json` and a box missing its `name` each answered with their own sentence naming the file. The pipeline on the instance was never saved and is untouched.

**Next ticket:** G-026 — consent to data processing on registration. Note this deployment has local registration **off** (`ALLOW_LOCAL_REGISTRATION=false`, A-003), so the registration form says so rather than rendering; the accept-invitation form creates an account too and is the reachable half.

---

### 2026-09-10 — G-026: Consent to data processing on registration

**Ticket:** G-026  
**Status:** done

**What was built:** `components/auth/consent-checkbox.tsx`, wired into `RegisterForm` (A-003) and `AcceptInvitationForm` (S-024), a `Consent` namespace in both locales, **DEC-129**, and a test in `e2e/accept-invitation.spec.ts`.

**The row said "cheap to restore, or record the decision instead", and it turned out to be both.** Restoring the tick on the registration form is four lines. What took the reading was the row's own second clause — _the accept-invitation form creates an account too_ — because if that is true, putting the consent only where legacy puts it restores the letter of the thing and not the point of it.

**It is true, and it is the half that matters here.** `RegistrationPresenter::actionAcceptInvitation` looks the invited address up and, finding no login, **builds the `User` entity on the spot** with the name the inviting teacher typed. And on this deployment local registration is **off** (`ALLOW_LOCAL_REGISTRATION=false`, A-003), so the invitation is the _only_ way an account is ever created through this frontend. Asking for consent on the one form nobody here can reach would have been a parity tick rather than a restored capability. So it is asked on both, which is DEC-129 and a deliberate divergence from legacy.

**Two things about it are stated in the code rather than left to be found later.**

- **It is stored nowhere.** core-api has no field for it — no `gdpr` anywhere in its source — and legacy sends it only as a stray key on the registration body, which core-api ignores. So this is a gate in front of a request, not a record of consent. A deployment that ever needs to _prove_ somebody agreed needs core-api, not this app.
- **A returning reader is asked too.** The same endpoint signs an existing login in and enrols them in the invited groups without creating anything, and the page cannot tell the two cases apart before submitting — the token carries an address, not an answer about whether it is registered. One redundant tick is the cheaper of the two mistakes.

**One component, not one per form**, because a sentence with legal weight should not exist in two places for whoever runs the deployment to reword twice. The refusal renders **beside the box** rather than in the form's own alert at the top: it is about that field, and a reader who has just pressed the button is looking at the button. That is also why the consent is not folded into the three conditions that _disable_ the registration button — a dead button explains nothing, and this is the one condition a reader can be told about in a sentence.

**The Czech string is legacy's with its grammar corrected.** `se zpracování` → `se zpracováním`, and `ReCodex` → `ReCodEx`; P-004's pass established that legacy's Czech is a source, not an authority.

**What was run:** `typecheck`, `lint`, `build`, 246 unit tests clean. **Verified live in both locales, both forms.** The invitation form's gate is now a permanent test (`accept-invitation.spec.ts`, which needs neither a session nor the seed). The registration form cannot be tested permanently here — this deployment closes it — so it was checked the way A-003 checked it: `ALLOW_LOCAL_REGISTRATION=true` in `.env.local`, a throwaway spec driving the real form, then the flag put back and the spec deleted. Filling every field and pressing Create with the box unticked answered "Your agreement is needed before an account can be created.", set no cookie and stayed on `/en/register`; ticking cleared the message without a second submit. Czech renders "Souhlasím se zpracováním osobních údajů…" on both pages.

**Two spec defects found by running the whole suite, both fixed here.** Neither is about G-026, and both were invisible until now.

- **`assignment-edit.spec.ts` raced itself.** Every test in that file edits the same seeded assignment, and every save core-api accepts carries the optimistic lock and increments it — so under `fullyParallel` two of them refuse each other with `400-010`. G-007's two saving tests passed on the run that introduced them and failed on the next one, against an assignment already at version 147. The file is now `test.describe.configure({ mode: "default" })`, which runs it in order.
- **G-028's own preview spec had never run and did not work.** It was written while `[seed] Intro to Programming` was missing from this instance (recorded in the G-011 entry), so it had only ever been skipped by its own failure to navigate. With the group back it reached the tabs and timed out: the field locator was rooted at `main` and then reused as `has:`, and **Playwright re-queries an inner locator's whole selector chain relative to the outer element** — a chain that starts with `main` matches nothing inside a tab panel. Rooted at `page` it passes, and it is worth having: it is the only test that proves the preview renders KaTeX and escapes raw HTML.

**Also: `pnpm format` had eleven files to fix** before this ticket touched anything — `format:check` fails on `HEAD` (`shadow-assignment-form.tsx`, `markdown-preview-tabs.tsx`, `structure-editor.tsx`, `structure-file.ts` and its test, `sidebar-nav.tsx`, and five docs). Committed here as its own formatting pass rather than folded in, since none of it is G-026.

**Next ticket:** G-030 — mapping two solutions' files by hand, the last open G row. Note the row's own escape clause: G-005 already says plainly which files it could not pair, so nothing is hidden without this. **PF-002 is the other candidate and is now unblocked** — DEC-126 removed the 5-second penalty that made it unmeasurable, and the restructuring it needs is already written and stashed ("PF-002: synchronous AppShell").

---

### 2026-09-10 — G-030: Mapping two solutions' files by hand

**Ticket:** G-030
**Status:** done

**What was built:** overrides in `pairFilesByName`, `encodeFilePair`/`parseFilePairs` (+15 unit tests), `components/solutions/pair-files-by-hand.tsx`, `?pair=` on the diff route, `Diff.unpaired` in both locales, **DEC-130**, and two tests in `e2e/solution-diff.spec.ts`. **With this the `solutions` inventory row closes and the G block is empty.**

**The one decision here is where the mapping lives, and legacy's answer could not be copied.** The legacy app keeps it in `localStorage`, keyed per solution pair. This app cannot: the pairing decides **which files the server fetches, reads and tokenises** — code is highlighted on the server (DEC-012) — so a mapping only the browser knows about cannot reach the thing that acts on it without moving the whole viewer client-side. It goes in the URL instead, `?pair=left:right`, repeatable.

**That is the better answer anyway, for the reason G-005 already gave.** A comparison somebody set up by hand is exactly the sort of thing worth sending to a colleague, which is why both solution ids are in the path rather than behind a picker. What is given up against legacy is that the mapping does not follow the reader to their next visit; what is gained is that it follows the link.

**The control needs no JavaScript.** One `GET` form per unpaired file, whose select carries whole `left:right` values and whose hidden fields carry the pairings already made — so a second pairing keeps the first, and the browser alone writes the address. T-020's trade for the exercise catalog, restated. Undoing one is a link carrying every _other_ pairing, which is the whole of what the legacy dialog's "unmap" button does and needs no dialog.

**Each side of a pairing is percent-encoded before the colon joins them** (`encodeFilePair` / `parseFilePairs`, 11 unit tests). A filename may contain a colon -- a ZIP entry's name already carries its archive, and nothing stops a submitted file being called `a:b` -- so the separator cannot be a bare one, and a malformed escape in a hand-edited URL is dropped rather than thrown.

**A pairing naming a file neither side has is ignored, not refused.** It arrives in a URL, where a stale link or a typo is an ordinary thing to meet, and the honest answer is the pairing the names give.

**The fixture was already in the seed and nobody had noticed.** `[seed] zip archive` submits a real `solution.zip` (S-017), and core-api reports its contents as `solution.zip#main.py` and `solution.zip#greeting.py` — so that attempt shares **no filename** with any other attempt at the same assignment. Diffing it against `[seed] correct` is precisely the case this control exists for, needs nothing created, and is what the new spec runs against.

**One accessibility note worth keeping.** The select is named by `aria-label` after the file it is about ("Compare helper.py with"), not by a wrapping `<label>` — three of these on one screen with the same two visible words would be three controls a screen reader cannot tell apart, and a wrapping label would override the useful name. The visible words are a fragment of the accessible name, which is the rule that actually applies.

**What was run:** `typecheck`, `lint`, `format`, `build`, **250 unit tests** (4 new) clean, and the full e2e suite. Verified against the seeded ZIP attempt: the three files listed as unpaired, `solution.py` paired with `solution.zip#main.py` from the select, the address gaining `?pair=solution.py%3A%3Asolution.zip%23main.py`, the diff heading reading `solution.py ↔ solution.zip#main.py` with the ZIP entry's own first line in the table, the remaining entry still listed, and "undo" putting the page back exactly as it was.

**Next ticket:** **PF-002** — the shell blocking every page's own fetching. It is the only item left with a measured cost, it is unblocked (DEC-126 removed the 5-second `.local` mDNS penalty that made it unmeasurable), and the restructuring it needs is already written and stashed as "PF-002: synchronous AppShell". Re-measure before trusting any number in that row: all of them were taken through the penalty. After it, PF-005 is three lines and PF-003 is a measured 81% cut; PF-004 needs a decision before an implementation.

---

### 2026-09-10 — PF-005: Breadcrumbs resolve one after another

**Ticket:** PF-005
**Status:** done

**What was built:** `lib/breadcrumbs/manifest.ts` (`resolveBreadcrumbs`), `components/users/profile-view.tsx`, the two pages that render it, and a test in `e2e/refusals.spec.ts`.

**Both cautions this row was filed with turned out to be real, and one of them was a bug for the length of a build.** The change itself is what the row said: match every prefix in one synchronous pass, then resolve the labels together instead of awaiting inside the loop.

**`allSettled`, not `all`, and the reason is not paranoia.** These resolvers throw Next's own `notFound()` and `forbidden()` — they decide what the reader sees. `Promise.all` rejects with whichever rejection _arrives first_, which on a path like `/groups/:id/users/:id` is a race rather than an answer. Settling everything and rethrowing in **path order** is what keeps the behaviour the sequential loop had.

**The empty `.catch()` on the hoisted promise is load-bearing, and the row's second caution is exactly why.** `/users/:userId` and `/profile` now hand the chain to `ProfileView` unawaited. Between creating that promise and React calling the component, _nothing is awaiting it_ — so a chain that rejects in that window is an unhandled rejection, and what the reader gets is the error boundary rather than the Not found page. Attaching an empty handler marks it handled without consuming it: the rejection still reaches the `await` inside `ProfileView`'s own `Promise.all`.

**That was found by the test the row asked for, not by reading.** "Checked against a deliberately-refused id" is written into this row, and the first build after the change failed it: `/en/users/00000000-...` rendered "Something went wrong" where it had rendered "The page you're looking for doesn't exist." The same id passes on the build before the change, which is what pinned it on this ticket rather than on PF-002. It is now a permanent test in `refusals.spec.ts`.

**The cost the row named is accepted and unchanged.** Resolving concurrently means a crumb that would have been refused no longer prevents the later ones being _issued_, so a refused page makes one or two requests it then discards. That is the trade for not making every page wait out its own breadcrumbs.

**Latent, as filed.** There is no number to report: Next memoizes the identical GETs the page goes on to make anyway, so this changes nothing measurable today. It was worth doing while it is still free, rather than after a crumb grows a read of its own.

**One spec had to be rewritten, and what it says now is more honest than what it said before.** G-007's "saving the text does not make the settings form's version stale" clicked the second save in the gap between the first action returning and its `router.refresh()` landing, and met core-api's optimistic lock about one run in three. Three attempts at a deterministic wait failed for instructive reasons: **nothing on screen changes when that refresh lands**, `networkidle` fires before the request is issued as readily as after it, and since PF-002 the RSC response _streams and stays open_, so awaiting it to completion hangs. What the test asserts now is the **state rather than the instant** — it waits for the refresh request to be made, then polls a settings save that is not refused, re-pressing a button that posts the same unchanged settings either way. Five consecutive runs, five passes. The window itself is real and stays: it is a few hundred milliseconds between two buttons no person clicks that fast, and closing it would mean either shared client state between two independent forms or a retry that DEC-092 deliberately refuses.

**What was run:** `typecheck`, `lint`, `format`, `build`, 250 unit tests clean, **307 e2e tests**.

**One flake worth naming rather than dismissing, because it has now been seen twice.** `landing.spec.ts` fails under full-suite load looking for the instance name on `/`, and passes on its own every time. The cause is not timing in the test: `getPublicInstances()` swallows a failed read and returns `[]` (`lib/api/instances.ts:146`), deliberately — `/` is the front door and a visitor should get the page rather than an error — so a core-api blip under two workers of load renders a landing page quietly missing one line. That is the right behaviour for that page and the wrong thing for a spec to assert unconditionally; left as it is, and recorded here so the next person who sees it does not go looking for a bug in the page.

**Next ticket:** **PF-003** — Shiki tokens carrying a style object each. Measured at 162,606 bytes of props JSON for a real 16 KB file, 9.9× the source, against 8 distinct styles in the whole file; interning them as a palette plus an integer index is an 81% cut. The row names the care needed: the class rules must set the same two custom properties at the same or higher specificity, and `:target` line highlighting must still win. After that only **PF-004** remains, and it needs a decision before an implementation.

---

### 2026-09-10 — PF-003: Shiki tokens carry a style object each

**Ticket:** PF-003  
**Status:** done. Filed **PF-009** for two further cuts it measured and did not take.

**What changed:** `lib/code/highlight.ts` builds one palette per file and each token carries an **integer index** into it; `CodeLine` takes the palette and looks up. Both viewers change at once because they share that component. Threaded through all four consumers — `code-viewer.tsx`, `source-file.tsx`, `reviewable-code.tsx` (the client island that pays for this) and `diff-view.tsx`.

**Re-measured before implementing, and the number is not the one in the row.** On a real 26 kB / 646-line source: 3,055 tokens, **8 distinct styles**, props JSON **259,167 bytes — 10.0x the source** — down to **103,808 bytes**. That is a **60% cut and 155 kB off one file**, not the 81% predicted, and the difference is not a mistake in either measurement: the row measured a 16 kB file, where the style objects were a larger share of the whole. What is left is the token `content` strings and JSON scaffolding, which no amount of style interning touches.

**The fact worth keeping, because it is the one that justifies the ticket at all: Shiki hands back a fresh style object per token.** 3,055 distinct object identities for 3,055 tokens, against 8 distinct values — checked with a `Set` of the objects themselves before writing any code. That matters because React's Flight format does deduplicate repeated _references_, so if Shiki had been reusing its eight objects the payload would already have been small and this ticket would have been measuring nothing. It is not, so it was not, and the palette is genuinely required rather than a tidier way to say the same thing.

**The cascade caution the row raised does not apply to what was built.** It anticipated emitting CSS classes. The palette keeps the same inline custom properties on the same elements — only the _route_ the value takes to get there changed — so specificity and `:target` line highlighting are untouched. Verified in the served HTML: same `<pre class="shiki">`, same seven `--shiki-light` values, colouring unchanged.

**`diff-view.tsx` needed more than a prop.** It highlights two files and renders tokens from either side into one table, so there are two palettes and a token's index is meaningless against the wrong one. `rowTokens` now returns the tokens **and** the palette they belong to, which is what makes the pairing impossible to get wrong at the call site.

**PF-009 filed rather than folded in:** the palette is still inline on every `<span>`, so it also ships in the SSR HTML — moving it to generated CSS removes that copy and _does_ raise the cascade question, and since both themes are fixed it could be a static block in `globals.css`. Separately, tokens as `[content, index]` tuples would drop the repeated `"content":`/`"style":` keys, worth roughly another 60 kB on the same file. The tuple change is the cheaper half and carries no cascade risk.

**Not verified against a live client island.** The 60% figure is a reproducible measurement of the props array, taken the same way the row's own was; measuring the real `/solutions/[id]/sources` flight payload needs a seeded solution with a review, which this half-seeded instance does not have (see the previous entry). Rendering was verified live instead.

**What was run:** `typecheck`, `lint`, `build`, 246 unit tests clean.

---

### 2026-09-10 — PF-008 closed as not a defect

**Ticket:** PF-008  
**Status:** not a defect. Filed and closed the same day; the mechanism is written down so it does not get filed a third time.

I filed PF-008 during PF-005 on the strength of a `curl` request: `/users/<nonexistent-id>` returned the app shell with an entirely empty `<main>`, and I was careful enough to confirm it was pre-existing rather than mine. **I was not careful enough to open it in a browser**, which is the whole story: the page reads **"Page not found / The page you're looking for doesn't exist. / Go home"**, themed and correct.

The mechanism, from the served HTML itself:

```
<main id="main-content" …><!--$!--><template data-dgst="NEXT_HTTP_ERROR_FALLBACK;404"
  data-msg="Switched to client rendering because the server rendering errored: NEXT_HTTP_ERROR_FALLBACK;404 at pageRead …">
```

`notFound()` is raised from `pageRead` **after streaming has begun**, so Next cannot rewind markup it has already sent. It marks the boundary, records the digest, and the client renders `app/[locale]/not-found.tsx` on hydration. `curl` sees the placeholder because `curl` does not hydrate.

**The lesson, and the reason this entry exists rather than a one-line status change:** a `curl`-only check reads the _first_ streamed byte of a page, not the page. That is exactly the right tool for the questions PF-005 was asking (payload sizes, unhandled rejections, error precedence) and the wrong one for "what does the reader see". Both were used on the same request and only one of them was applicable.

**Two residues, recorded rather than ticketed.** A reader with JavaScript disabled does get a blank `<main>` here — inherent to raising an interrupt mid-stream, and avoiding it means resolving existence before the shell streams, which is PF-002's territory rather than a bug of its own. And the response is HTTP **200**, which is already Q-016.

---

### 2026-09-10 — PF-002: The shell blocks every page's own fetching

**Ticket:** PF-002  
**Status:** done, and **measured** — which is the whole reason it had been parked.

**What changed:** `AppShell` is synchronous. The sidebar and the session notices sit in their own `<Suspense>` boundaries as _siblings_ of `{children}`, so all three start at once instead of the page waiting for the layout to return. `(app)/loading.tsx` becomes reachable with it — a suspended _layout_ sits above the boundary whose fallback that file is, so it had never had the chance to render.

**Every number this ticket previously carried is void, and that is worth saying plainly.** They were taken through the 5-second-per-connection penalty that DEC-126 later explained as mDNS resolving `.local`, which is also why the ticket parked itself: "it is the measurement that blocked it, not the code". With the penalty gone, nine runs per route, medians:

| route           | TTFB before | TTFB after | total before | total after |
| --------------- | ----------- | ---------- | ------------ | ----------- |
| `/en/dashboard` | 89 ms       | **36 ms**  | 277 ms       | 291 ms      |
| `/en/groups`    | 57 ms       | **35 ms**  | 61 ms        | 66 ms       |
| `/en/exercises` | 69 ms       | **39 ms**  | 80 ms        | 80 ms       |
| `/en/profile`   | 62 ms       | **39 ms**  | 63 ms        | 82 ms       |

**TTFB falls 40–55%. Total load time is flat to marginally worse.** Both halves are the honest result rather than half a disappointment: the ticket's premise was "TTFB is shell + page, never `max()`", and that is confirmed precisely where it was made. The total is bounded by the slowest read on the page either way, and on this host core-api answers in ~30 ms, so the shell's share of the old _sum_ was small to begin with; the streaming machinery costs a little back. On a deployment where core-api is a real network hop rather than loopback, the sum-versus-max difference is where this would pay. Run-to-run noise was measured first, by accident: a `git stash push` silently failed on an unmerged file and I measured the same code twice — ~5 ms TTFB, ~30 ms total, which is what makes the TTFB column meaningful and the total column not.

**The merge needed judgement rather than conflict resolution.** The stash predated G-023, so `app-shell.tsx` conflicted over the view-as banner. The banner and the broadcasts are now one `SessionNotices` boundary: they need the same `getCurrentUser()` (memoized per request, so one call serves both), and to the reader they are one strip above the page saying something about _their_ situation rather than about what they asked for. The stash also inserted `SkipToContent` between `SidebarNav`'s docblock and its function, orphaning the docblock; that is put back in order.

**Verified live:** skip link, `<main id="main-content">` landmark, all six sidebar sections, G-025's QR trigger and G-031's FAQ link all still render, and the HTML carries 7 streaming placeholders. `typecheck`, `lint`, `build`, 256 unit tests green.

**Two notes for the next session.** The `git stash` entry this ticket pointed at **has landed and is superseded** — it is left in place rather than dropped, but it still describes itself as "parked" and should not be trusted or re-applied. And the browser tool's console buffer accumulates across a whole session and is not cleared by `console.clear()`: it still shows "Merge conflict marker encountered" and "Broadcasts is not defined" from the intermediate states of this very merge, long after the file was clean. A file carrying a conflict marker cannot typecheck or build, so those four passing checks are the evidence, not the console.

**Next ticket:** PF-009 — do its cheaper half first (tokens as `[content, index]` tuples, ~60 kB more off the file PF-003 measured, no cascade risk) before the CSS-palette half.

**Correction to the PF-005 entry above:** its backlog _status cell_ was never actually flipped to `done` — the string replacement that was meant to do it missed by one space in the column padding and, unlike the note replacement beside it, carried no assertion, so it failed silently and the row still read `todo` four commits later. Found by listing open tickets at the end of this batch. Fixed, and worth the note because the lesson is not about spaces: **every edit to these tables should assert that it matched**, or the record quietly disagrees with the code.

---

### 2026-09-10 — CI: the formatting check nobody was running, and the actions' Node 20

**Status:** both fixed.

**The red build was mine, and the cause is a gap between the brief and the workflow.** Brief §8 says "`typecheck`, `lint` and `build` pass on every commit", and that is the sequence I have been running all session. **`.github/workflows/ci.yml` runs five: `typecheck`, `lint`, `format:check`, `build`, `test`.** Fifteen files failed Prettier — all of it line-wrapping in files I wrote through scripted edits rather than an editor, so none of it was visible to the other four checks, and `pnpm format` fixed all fifteen with no semantic change. `AGENTS.md` constraint 7 now records the real five-command sequence, since the brief's three-command version is what caused this and will cause it again otherwise. (The edit adding that note itself failed `format:check` on the first attempt, which is the neatest possible argument for having written it.)

**The Node 20 question was worth asking and the answer was not where I first looked.** Node itself is 22 everywhere it is pinned — `.nvmrc`, `package.json#engines`, and both `FROM` lines in the Dockerfile — and the workflow takes its version from `.nvmrc` rather than hardcoding one, so there is no stale Node in the app. The stale Node 20 is the **actions' own runtime**: `actions/checkout@v4` and `actions/setup-node@v4` both declare `using: node20`, which GitHub is retiring. Checked against each action's own `action.yml` per tag rather than from memory: v4 is node20, and v5, v6 and v7 are all node24. Both are now on **v7**.

**v7 rather than v5, for a reason worth recording.** `setup-node@v5` introduced automatic package-manager caching keyed on `package.json#packageManager` — and this workflow installs pnpm through `corepack enable` **after** setup-node runs, so a v5 that decided to cache pnpm would have looked for a binary that did not exist yet. `v6` limited that automatic caching to npm, so the hazard is gone by the version we are on. It would not have fired here anyway: this repo declares no `packageManager` field. Both facts are in a comment beside the step, because the next person to bump this will face the same question.

**Noticed and not acted on:** `corepack enable` with no `packageManager` field means corepack resolves whatever pnpm it defaults to, so the pnpm version is not actually pinned even though `pnpm-lock.yaml` is. It has not bitten anything and the lockfile is respected by `--frozen-lockfile`; worth a line here rather than a ticket.

---

### 2026-09-10 — PF-009: the token palette into CSS, and tokens as tuples

**Ticket:** PF-009  
**Status:** done, both halves. Committed as two steps so each is revertible on its own.

**(b) tokens as `[content, style]` tuples.** An object repeats its own key names once per token — `"content":` and `"style":` are 21 bytes of scaffolding against 3 for `[",]`. Props JSON **103,881 → 48,855 bytes**, 55 kB off the file PF-003 measured. Together with PF-003 that is **259,167 → 48,855, an 81% cut** — which is exactly the figure PF-003's row predicted before either step existed. It was right about the destination and wrong only about reaching it in one move.

**(a) the palette as CSS.** `lib/code/palette.ts` turns a file's palette into rules emitted beside the block, and spans carry a class instead of an inline `style`. Measured: **155,907 bytes of inline custom properties against 36,684 of class attributes plus 384 of rules — about 119 kB off the served HTML**, which makes (a) the larger of the two halves.

**The design decision that made (a) simple: the class name comes from the colours, not from the palette index.** Several files render on one page, each highlighted separately with its own palette, so index-based names would collide _and mean different things_ — `tk3` would be one colour in one block and another in the next. Deriving the name from the light and dark hex means a collision only happens where two blocks genuinely share a colour, and there the duplicate rule is identical and idempotent. That removed the need to thread a unique per-block prefix through `CodeBlock`, `CodeLine` and `diff-view`, which is what I had assumed this would cost.

**The cascade caution PF-003 handed down turned out to be mild, once checked rather than feared.** `app/globals.css` reads the two properties in `.shiki span { color: var(--shiki-light) }` and switches which one under `.dark`; a class setting them is the only source once the inline copy is gone; and the `:target` line highlight sets **`background-color`**, never `color` — so it was never in competition with a token colour. Verified live: 49 classed spans, all 49 resolving the property, 6 distinct colours per theme, and toggling `.dark` swaps github-light for github-dark (`#24292E` → `#E1E4E8`).

**Two defects the checks caught and review had not.**

`pnpm build` — and _only_ build — failed with **"'server-only' cannot be imported from a Client Component module"**. `tokenClassName` and `paletteCss` had gone into `highlight.ts`, which is `server-only`, and `CodeLine` needs them while being rendered inside S-018's client island. `typecheck`, `lint`, `format:check` and the unit tests all passed over it. This is the brief's §8 claim about `build` earning its place for the first time this session, and the fix was to move two pure functions to their own module, where they belonged regardless.

A unit test caught `paletteCss` deduplicating by **rule text** instead of by **class name** — the name is lower-cased and the rule embeds the value as written, so `#032F62` and `#032f62` are one class and two strings, and the same selector was emitted twice with equivalent values. Harmless on the page, wrong in the bytes, and it would have quietly contradicted the module's own docblock.

**Left inline, deliberately and out of scope:** code fences inside markdown. Their HTML is generated by `rehypeShikiFromHighlighter` and never passes through `CodeLine`, so the four remaining inline-styled spans on the design-system page are all inside the markdown slot — confirmed by position rather than assumed. A smaller, separate opportunity.

**What was run:** all five CI commands green, 263 unit tests (7 new).

**Next ticket:** **PF-004** — Zod's runtime, 17% of all client JS. Its own row says it "needs a decision before an implementation", and that decision is a UX trade rather than a technical one, so it is the next thing to put to the operator rather than to start.

---

### 2026-09-10 — PF-004: Zod's runtime is the largest client chunk

**Ticket:** PF-004  
**Status:** done. **With it every measured performance item is closed**, and the only thing left in the backlog is X-001, which is an idea rather than a ticket.

**The row offered two ways out and both were bad; there was a third it did not know about.** It said "move validation server-side and lose instant client feedback, or replace the resolver", and put the decision to the operator because that is a UX trade. The answer is **`zod/mini`, already present inside the installed Zod 4.4.3** — the same validation engine behind a tree-shakable function API. Client-side validation is _kept_, no dependency was added beyond the types-only `@standard-schema/spec`, and the brief's stated stack is unchanged.

**Measured before committing to the rewrite, which is what the operator asked for.** An esbuild probe of exactly the constructs these 20 schema files use — every `z.*` and every chained method, counted first — came out at **327,715 raw / 54,134 brotli for classic against 23,260 / 6,641 for mini**. The classic figure landed within 15% of the real chunk, which is what made the probe worth trusting. A first pass at estimating from `node_modules` file sizes had suggested a much smaller win and was wrong, because it counted `v4/core` (220 kB, shared by both variants) as unavoidable — the point of mini is that the core _is_ shakeable when reached through functions rather than methods. Worth remembering: for a tree-shaking question, file sizes are not evidence.

**Delivered, against the real build:**

|                   | raw        | brotli     |
| ----------------- | ---------- | ---------- |
| the classic chunk | 283,397    | 52,108     |
| the mini chunk    | **45,031** | **10,900** |

**41 kB brotli off twelve of forty-six routes, and total client JS 1,834,168 → 1,593,673 raw (−13.1%).** No chunk carries `ZodCIDRv6` or `ZodJWT` any more, which is how the row identified the waste in the first place.

**`useServerActionForm` no longer names a validator.** It takes a `StandardSchemaV1` and uses `standardSchemaResolver`; mini exposes `~standard` (v1, vendor `zod`), so that file changed by one import and one cast comment. `@standard-schema/spec` had to be _declared_ rather than used transitively — pnpm's strict `node_modules` is the reason the brief chose it, and a phantom dependency here would have been exactly what it exists to prevent.

**What the conversion actually cost, and where it tried to go wrong.** Twenty files, mechanical, and `typecheck` caught every single miss: eleven unbalanced parens where a wrapped `superRefine` opened two brackets and the old closer shut one, one file whose two **chained** `.refine()`s had to become a single `.check(a, b)` (chaining them produced nested nonsense), and three nested or multi-line chains a line-oriented rewrite could not see. **The real trap is `.min`/`.max`**: they mean `minLength` on a string or an array and `minimum` on a number, and only the base type says which — a converter that guessed would have silently changed what every numeric field accepts. `lib/actions/group-settings.schema.test.ts` was written **before** converting anything, to pin trimming, both numeric bounds and all three custom refinements, because a check attached to the wrong node typechecks perfectly and fails only in front of a user.

**Verified live where it matters.** The two specs that assert _client-side_ validation both pass: `group-create`'s "refuses the name that is blank in every language, without asking core-api" and `account`'s mismatched-password test. `group-settings.spec.ts` fails three tests, and those are the half-seeded instance rather than this change — confirmed the same way as before, by stashing the work and re-running them against the committed code, where they fail identically.

**All five CI checks green, 270 unit tests (7 new).**

**Next:** nothing measured remains. **X-001** (the GitHub Classroom importer) is the only open item and is an _idea_ — it is beyond parity, the operator asked about it, and its own write-up says it waits until the sweep has said what is finished. The sweep has now said so: every G ticket and every PF ticket is closed.

---

### 2026-09-10 — The seed, actually fixed: it was choosing a different instance each run

**Status:** seed fixed and run to completion. **The whole Playwright suite ran for the first time in three sessions: 278 pass, 25 fail, 1 skipped**, and the 25 are filed as **PF-010** — none of them a product defect.

**The diagnosis three sessions got wrong, including twice by me.** This file has recorded the problem as "`[seed] Intro to Programming` is absent", then as "the killed seed left duplicate groups". Both were symptoms. The cause is one line:

```ts
const instances = await api<{ id: string }[]>("GET", "/instances", …);
const firstInstance = instances[0];
```

**This deployment has two instances** — `Univerzita Palackého v Olomouci` and `Frankenstein University, Atlantida` — `GET /instances` promises no ordering, and the order it returned changed between runs. So an earlier run seeded one instance and mine seeded the other, leaving **two half-sets of identically-named groups under two different roots**. Every spec that navigates by group name then matched two links or none depending on which half it found, and nothing on any screen said which instance anybody was looking at. That is why it kept being re-diagnosed.

**Fixed properly rather than cleaned up.** `chooseInstance()` now picks the instance that **already holds this script's own groups** — anchored on any of the three top-level seed group names, so a run that died part-way is still recoverable — falling back to the first instance only when nothing is seeded anywhere, and saying so. `SEED_INSTANCE_ID` overrides both and is validated against the real list (which caught me immediately: I passed a UUID I had guessed from an 8-character prefix and it refused it).

**The cleanup, and the trap in it.** Five stray `[seed]` groups were deleted from the wrong instance, plus one misparented `Lab A` that had ended up under an operator's own `Jazyk Python`. My first pass missed one: **`GET /groups` excludes archived groups by default**, so a second `[seed] Retired Course` survived and kept one spec failing with a strict-mode violation until I looked again with `archived=true`. Worth remembering — a cleanup script that lists groups the obvious way is blind to exactly the ones a seed marks archived on purpose.

**A full wipe was the wrong answer and I nearly reached for it.** `docker compose down -v` is what the brief names as the reset, but the tree also holds `Katedra informatiky` and `2025/2026 - Jazyk python`, which carry no `[seed]` prefix and are the operator's own. Deleting the five strays cost nothing and destroyed nothing of theirs.

**State now:** one instance holds all six seed groups, no name is duplicated anywhere (checked with `archived=true` across both instances), 25 exercises in the catalog, and `pnpm seed` exits 0 having chosen its instance by itself.

**What the 25 remaining failures are, and why none of them is the seed.** The most instructive: the seed creates **three** assignments of `[seed] Echo Greeting` in one group _by design_ — one with a second deadline, one primary, one deliberately unsubmitted (F-029 asked for that state) — and an assignment displays its **exercise's** name, so all three render the same label. `assignment-solutions.spec.ts` does `…getByRole("link", {name: "[seed] Echo Greeting"}).first()` and lands on the second-deadline one, which correctly has nothing submitted. The specs assume a uniqueness the seed never promised, and it only shows now that a _complete_ set exists — while the instance was half-seeded they were failing earlier, for the other reason. The other two buckets are count assertions that no longer match the data and two assumptions about there being one instance. All three are in PF-010.

**Not done, deliberately:** fixing those 25. They are spec work rather than seed work, the seed's three-assignment design is what F-029 wanted and should not be bent to suit a `.first()`, and it is the operator's call whether that is worth the time now.

---

### 2026-09-10 — Reconciling two parallel lines of work

**Ticket:** none — a merge.
**Status:** done. `typecheck`, `lint`, `format:check`, `build` and **269 unit tests** clean.

**What happened:** the same six rows — G-026, G-030, PF-002, PF-003, PF-004, PF-005 — were built twice, independently, from the same commit (`70e53e0`). Two histories, eight commits against ten, eighteen files in conflict. This entry records which implementation survived each row and why, because the reasoning is not recoverable from the diff afterwards.

**Where the two agreed, which was more than expected.** PF-002 arrived at the same structure on both sides: a synchronous `AppShell`, the sidebar and the session notices as `<Suspense>` siblings of `{children}`, `(app)/loading.tsx` reachable at last. PF-005 likewise: match every prefix synchronously, resolve the labels through `allSettled`, re-throw in path order. PF-003 converged on the same tuple-and-interned-palette design down to the shape of the `Map` keyed by `JSON.stringify`. Independent agreement on a design is worth more than either argument for it, and none of those three needed a decision.

**Where one was a superset, it won.** PF-003 continued into **PF-009** on one side only — the palette as CSS rules instead of an inline style per span, `lib/code/palette.ts`, another ~119 kB off the served HTML — so that line was taken whole. PF-004 was the one genuine fork: **`zod/mini`** (twenty schema modules rewritten, −41 kB brotli across twelve routes, −13.1% total client JS) against a **lazy-loaded resolver** (Zod deferred out of the first paint, −53 kB brotli on `/profile/edit`, unchanged where there is no form). Both were built and both were measured. `zod/mini` won because it removes the bytes rather than moving them, and because deferring a 10.9 kB brotli validator does not pay for the ref-and-promise dance or for the rule it imposes — that a schema module may no longer export anything a client component needs as a _value_. **DEC-132 now records the decision that landed**, including the option that did not.

**Where one was more complete, it won.** G-026 was built on the registration form alone on one side and on **both screens that create an account** on the other (`components/auth/consent-checkbox.tsx`, shared by A-003 and S-024), with the refusal as a sentence beside the box rather than a disabled button. The broader one is DEC-129 and is what survived. PF-005 was the same change on both sides except for **one empty `.catch()`**: hoisting the crumb chain past `ProfileView` leaves it unawaited for a window, and a chain that rejects inside that window is an unhandled rejection — the reader gets the error boundary instead of the Not found page. One side hit it, one side reasoned it away. It hides from the obvious test, because over a nonexistent id the crumb is a _fetch_ and the handler is attached long before core-api answers; what rejects inside the window is this ticket's own new fast path, where an unregistered prefix throws synchronously and `/profile`'s chain is a message lookup rather than a fetch. The guard stayed, and `refusals.spec.ts` now pins it.

**Where each half was better, both were taken.** G-030 put the mapping in the URL on both sides. The surviving control is the richer one — an undo link per pairing, `left ↔ right` headings, and overrides applied _before_ the names so a file that would have matched by name can still be re-pointed — and it now carries the other side's **encoding**: each half percent-encoded before the colon joins them, because a filename may contain a colon and a ZIP entry's name already carries its archive. `applyManualPairs` was dropped as superseded and its cases restated against `pairFilesByName`. Similarly PF-002 kept the shell from one side but the **skip link** from the other: making `SkipToContent` a small client component reading `Nav` keeps it in the first byte, where the other version had had to put it behind the sidebar's boundary — a keyboard reader could reach the page before the link that exists to get them there.

**The asymmetry that decided the test-side work.** One line touched **no** `e2e/` and **no** `scripts/` file while making the PF-002 streaming change, and that change breaks three specs that were written against an assembled document: `command-palette` arms Ctrl-K a beat after the page, `dashboard`'s `evaluateAll` is a one-shot query with no auto-wait, and `assignment-edit` clicks into the gap between a save returning and its `router.refresh()` landing. Those fixes, `e2e/solution-diff.spec.ts`, the `refusals.spec.ts` case above, and the seed fix all came from the other line and are all kept. The seed one matters beyond its own row: `exercise-catalog.spec.ts` had been reading orphaned exercises left by failed runs as though they were a fixture, and `ensureAuthoredExercises` now makes the second author properly — which is also what unblocks the "half-seeded instance" that had left G-030 unverified live and three `group-settings` failures unexplained.

**Verified so far, and what is still owed.** Five static checks green, 269 unit tests green, and `app-shell.spec.ts` 6/6 against the merged build -- chosen because it is the spec that exercises PF-002 most directly. The full `pnpm test:e2e` was run afterwards and is recorded in the last entry of this file: **308 pass, 0 fail** — PF-010's 25 did not reproduce, for reasons that entry sets out.

**Two things about the instance, found the hard way while trying to run it.** Twenty-five `e2e broadcast/floor/read` messages had accumulated from runs that died before their own `finally` -- and unlike an orphaned exercise, an orphaned broadcast renders inside `<main>` on every page, so it failed 64 specs at once before it was tracked down. Deleted, and the leak closed by an `afterEach` sweep in the commit after this one; it is PF-007's lesson in a file PF-007 did not name. Separately, **killing a suite mid-run leaves its `pnpm start` server behind**, and `reuseExistingServer` then hands the next run a wedged one -- a whole run's worth of failures that look like product defects and are not. Kill the server too, or let the run finish.

---

### 2026-09-10 — The merged tree, run whole: 308 pass, 0 fail

**Ticket:** none — verification owed by the merge two entries above.
**Status:** done.

`pnpm seed` on the deterministically chosen instance, then `pnpm test:e2e`: **308 passed, 0 failed, 4.2 minutes.** `retries` is 0 outside CI, so nothing is masked by a second attempt. With the five static checks and 269 unit tests, the merge is now verified end to end and nothing is owed.

**PF-010's 25 failures did not reproduce**, and the honest reading is that the instance differed rather than that the row is wrong. Three things about this run were not true of the one that filed it: the instance was fully re-seeded rather than partly, `chooseInstance` put that seed on the instance that already held the seed groups, and 25 orphaned `e2e ` broadcasts had been deleted. Bucket (b) of that row asserts _counts_ (`Showing 1-15 of 15` against 9 pipelines) and bucket (c) asserts _which instance the landing page names_ — both are properties of instance state, not of the specs, so passing here says little about failing there. Bucket (a)'s ambiguous `.first()` navigation is the one that should have failed either way and did not — **and the entry below establishes why it passed, which is not to the suite's credit.**

**What this run cost, recorded so it is not paid twice.** Two full-suite runs were thrown away before this one. The first failed 64 specs on the orphaned broadcasts — an orphaned exercise hides until somebody opens the catalog, but an orphaned broadcast renders inside `<main>` on every authenticated page, so it fails anything reading `getByRole("main")`. The second failed almost everything because the first had been killed with `pkill -f playwright`, which leaves the `pnpm start` server behind, and `reuseExistingServer` then handed the new run a wedged one. Neither was a product defect and both looked exactly like one. **Kill the server too, or let the run finish.**

---

### 2026-09-10 — PF-010: the specs that navigate by a name three assignments share

**Ticket:** PF-010
**Status:** mostly done. Buckets (a) and (b) closed, (c) half; one claim left that does not reproduce.

**The green run in the entry above was luck, and finding out why is most of this ticket.** `.first()` over the group's assignment links resolves to the **second-deadline** assignment — and on this instance that one carries **four solutions left behind by earlier suite runs**. So `assignment-solutions.spec.ts` asserted "lists every attempt" against the assignment the seed intends to have none, and passed on submissions that should not exist. The instance that filed PF-010 had no such residue, so the same line failed there. Neither run was testing what it read as testing.

Querying the three directly is what settled it:

```
806ce477  2nd=True   sols=4   hint=Has a second deadline ...
80f6cbfe  2nd=False  sols=2   hint=Nothing submitted yet ...   <- the seed means zero
c3793a29  2nd=False  sols=4   hint=Print the exact greeting ...  <- the primary
```

The middle row is the finding worth keeping: **the "nothing submitted yet" fixture has two submissions**, because specs that submit do not clean up after themselves. F-029's empty-state fixture has been quietly gone for some time and nothing noticed, because no spec asserts on that assignment by name.

**The fix names the assignment rather than counting on the order.** `seededAssignments()` tells the three apart by what the seed _guarantees_: the second-deadline one is the only assignment anywhere with one, which the seed says in as many words, and the unsubmitted one by its student hint — deliberately **not** by counting its solutions, because that is precisely the property that drifts, and a helper that broke on a drifted instance would be the same mistake one level down. The primary is what is left. The specs then click the link by `href`, so the navigation from the group page is still exercised rather than replaced by a `goto`. `assignment-edit.spec.ts` takes the second-deadline one (it asserts the second deadline is present); `assignment-solutions.spec.ts` takes the primary (it asserts submissions are listed).

**Bucket (b), the hardcoded totals.** `pipelines.spec.ts` asserted `Showing 1–15 of 15.` and `users.spec.ts` asserted `Showing 1–2 of 2.` — both are facts about a deployment, not about the app, and the same file already had the robust form a few lines away (`/^Showing 1–20 of \d+\.$/`, with the total read out of the page). Pipelines now asserts the counter is present and self-consistent, which is what "the list is counted and fits one page" actually means. Users reads the unfiltered total first and asserts that narrowing narrows, plus that an account which must survive the filter does.

**Bucket (c), half.** `landing.spec.ts` pinned `Frankenstein University, Atlantida`; this deployment has two instances and `/v1/instances` promises no ordering, so which one the page names is core-api's business. It now asks that endpoint — the same read the page makes — and asserts the page names one of them. **The other half does not reproduce and the code says it cannot:** `getByPlaceholder("Filter groups")` is claimed to be a strict-mode violation from the control being rendered twice, but `data-table.tsx` renders one filter input, and `/groups` and `/archive` are separate pages with one table each. Left open rather than closed, for whoever has the failing instance to confirm.

**Not done here, and deliberately.** The seed is not changed to sweep the stray solutions off the unsubmitted assignment. The specs no longer depend on that assignment at all, so the suite is honest either way, and deleting submissions is a bigger decision than a test fix — it belongs to whoever owns the fixture. It is recorded above so it is not rediscovered a fourth time.

**What was run:** typecheck, lint, format, build, 269 unit tests, and the full e2e suite — **308 pass, 0 fail.**

**Green before and green after is not the evidence here**, since the run before was green by accident. The evidence is that the specs now go somewhere else: `seededAssignments()` resolves `primary` to `c3793a29`, where `.first()` had been handing back `806ce477`. So `assignment-solutions.spec.ts` navigates to a **different assignment than it did yesterday** — the one the seed actually submits to — and still passes. That is the difference between the assertion holding and the assertion meaning something.

---

### 2026-09-11 — PF-011, PF-012, PF-013: 308 pass, 0 fail, and the twelve that got there

**Tickets:** PF-011, PF-012, PF-013 (new), PF-010 bucket (c) closed, F-028 re-checked.
**Status:** done. `pnpm test:e2e` from a cold build: **308 passed, 0 failed, 2.8 minutes**,
`retries` at 0 outside CI so nothing is masked. Five static checks and 269 unit tests green.

**Where this started.** The three commits this session began with turned out to duplicate work
already on `origin/main` — a parallel line had closed PF-010's buckets (a) and (b) with
`seededAssignments()`, which finds the three assignments by what the seed guarantees rather than by
position, and does it better than the version being rebased: it clicks the link by `href` instead
of `goto`-ing the id, so the navigation from the group page is still exercised. Those commits were
dropped rather than merged. **One of them was also wrong on its own terms:** it keyed the
assignment settings form by `assignment.version` to fix a stale optimistic lock, and the lock is
not stale — the form reads `assignment.version` from props at save time, so `router.refresh()` does
hand it the new one. Keying it would have thrown away a teacher's unsaved settings every time they
saved a text. Upstream's answer, a `waitForResponse` on the RSC refresh and a poll, is the right
one. What did survive from those commits is in PF-012 below.

**Then the whole suite, and twelve failures.** None was a flake and none was upstream's fault:
every one was a fixture the specs believed in and the seed did not make, or made somewhere else.
Three tickets came out of it.

**PF-011 — the leak.** `assignments.spec.ts` and `solution-rerun.spec.ts` submit a real solution
and both removed it at the end of the test body: one after its last assertion, one in a `finally`
that a Playwright timeout skips — PF-007's defect exactly, one entity over.
`e2e/helpers/created-solutions.ts` registers the file's `afterEach` and takes the id the moment the
URL is known. **The residue was worse than the exercise case because where it lands is not fixed:**
both reach the submit form through the dashboard's first row, so an orphan attaches to whichever
assignment the dashboard sorted first. F-029's "nothing submitted yet" fixture had collected two and
had not been an empty-state fixture for some time, which nothing noticed because no spec asserts on
that assignment by name.

**PF-012 — the seed repairs what earlier runs of it left.** Four things it now guarantees:

- **Its three assignments are found by student hint, not by position.** All three are created
  inside the same second, so `createdAt` ties and the tiebreak is an arbitrary id comparison —
  `existing[0]` meant "whichever id sorts first". The file's own sort comment records the symptom
  this caused ("two solutions noted `[seed] correct` under two different assignments") without the
  sort ever having been a fix for it.
- **A reused account is checked against the chosen instance.** An address is unique
  deployment-wide and a user belongs to one instance, so an account looked up by email can be one
  created against another. Nothing can move it, so this stops with what to do instead of trying.
- **A reused exercise is checked against the seeded group, and this one was live.**
  `[seed] Echo Greeting` was attached to an operator's own `Jazyk Python` and nothing else: an
  earlier run created it there, and every run since found it by name and reconfigured it in place.
  An exercise's groups are what a course may assign _from_, so the group picker offered nothing and
  two specs failed on a fixture core-api's own search could find perfectly well. Attached rather
  than moved — detaching would write to somebody else's group, and a stray attachment there is
  theirs to remove.
- **It sweeps what it did not intend:** prefixed solutions on its three assignments that are not in
  the set it just made, and evaluation runs beyond the first on its reference solution. Both are
  residue from the position-picking above and from PF-011, and both were breaking exact counts.
  F-029's empty fixture is empty again.

**PF-013 — the pattern behind most of the rest.** A helper named `seeded*` that walks _every_ group
returns whatever an operator has in their own courses first, and calls it a fixture.
`seededAttemptsOfOneAuthor` returned two attempts on an assignment inside `Jazyk Python`, so the
spec that needs the seed's ZIP submission got two plain ones; `firstSeededSolution` returned a
solution with no review, so "asking for a review is not offered once one exists" was reading a
screen where one did not exist. Both are scoped to the seeded group now — `seededGroup()` also
refuses if two groups share its name — and `firstSeededSolution` reads the primary assignment,
which is where the seed puts everything it submits, and takes an optional note so three specs that
mutate a solution stop mutating the same one.

Three more of the same family. A **hardcoded classmate UUID** from a database since re-seeded, so
the spec asserted a refusal of somebody who no longer exists and got "Page not found" — the right
answer to the wrong question. **`exercise-config` asking for a Java checkbox** on a deployment
whose four installed languages are `bash`, `c-gcc-linux`, `cxx-gcc-linux` and `python3`; the test
is about two ordinary languages saving, so it now names one that exists. And **`dashboard`
asserting the seeded review is the _first_ row** of a queue ordered oldest-first across every group
the teacher administers — which row leads is a fact about the deployment, that the row is queued and
the order is oldest-first are facts about the app, and both of those are still asserted.

**And one that is core-api's rule rather than a spec's mistake, now DEC-133.** `reviewRequest` is a
**unique flag per author and assignment**: `actionSetFlag` sets it to `false` on every other
solution of the same author before setting the one it was asked about. So asking for a review as
Alice silently withdrew the seed's own request from her other attempt — the row the teacher
dashboard's queue and the plagiarism report are both reached through. It failed the way shared state
always does: intermittently, in a different file, depending on which of two workers finished first.
**A `finally` that clears the flag it set does not restore what setting it displaced**, and nothing
in the response says what that was. Those specs write on the classmate now, whose flags nothing
reads, and `plagiarism.spec.ts` no longer enters through the dashboard queue at all — whether the
queue leads there is `dashboard.spec.ts`'s subject; this one is the report.

**One product defect, found through all this and worth its own line.** A solver whose author has
been deleted is no longer rendered as a row. `/v1/assignment-solvers` keeps reporting the record
with `solverId: null`, and it reached the class-progress table as a person with no name, sorted to
the top by the empty string, whose link pointed at `/users/null` and was answered with a refusal
when a teacher clicked it.

**Two API findings, filed rather than worked around.**

**Q-029: a solution that has been through plagiarism detection can never be deleted.**
`DELETE /assignment-solutions/{id}` answers **500** with
`Doctrine\DBAL\Exception\ForeignKeyConstraintViolationException` for any solution named in a
detection record — as the tested side or as the source of a matched file — and neither key cascades.
**And the record cannot be removed either:** the plagiarism route list has `listBatches`,
`batchDetail`, `createBatch`, `updateBatch`, `getSimilarities`, `addSimilarities` and **no `DELETE`
at any level**. So the state is terminal through the API. Three swept solutions are refused for
exactly this reason; the seed logs each, counts them, and carries on.

**Q-030: core-api answers 500 for a solution whose author has been deleted.**
`AssignmentSolutionViewFactory.php:69` passes the author straight into
`findBestSolution(): Argument #2 ($user) must be of type User, null given`. core-api already knows
this case exists — `actionSetFlag` opens by throwing `NotFoundException("Author of solution '$id'
was deleted")` — so the guard is missing from the view factory, not from the concept. This is what
was behind `refusals.spec.ts` intermittently rendering the error boundary in place of the Not found
page: the crumb chain's read happened to include an authorless solution, and "Something went wrong"
is the honest answer to a 500.

**PF-010's last bucket, closed on the instance that filed it: it does not reproduce.**
`groups.spec.ts` passes there, and the row's own reading was right about why — `data-table.tsx`
renders one filter input, and `/groups` and `/archive` are separate pages with one table each. The
nearest thing to a doubling is that the input's `aria-label` carries the same string as its
placeholder, and `getByPlaceholder` does not match an `aria-label`. Nothing was changed for it.

**F-028 re-checked, and nothing has moved.** `typescript-eslint@8.70.0` and its canary still declare
`typescript: >=4.8.4 <6.1.0`; `eslint-plugin-react` is still `7.37.5` peering at `^9.7` with an
older `next` tag. Both pins are already at the newest version their own range allows, so there is
no interim upgrade to take either. Dated note in AGENTS.md.

**What is still on the instance, and it is the operator's call.** Three solutions the seed wants
gone cannot be removed through any API (Q-029), and one of them is authorless, which is what makes
core-api throw (Q-030). Their only routes out are a write straight to the deployment's database or a
wipe and re-seed. **The suite is green with them in place** — every spec that used to trip over them
now names what it needs instead of taking whatever was first, which is the more valuable outcome
anyway — so this is tidiness rather than a blocker. Also on the instance, and also not ours to
delete: an assignment of `[seed] Echo Greeting` inside `Jazyk Python` carrying two of Alice's
solutions, from the same pre-`chooseInstance` run. The seed reports the stray attachment and leaves
the group alone.

---

### 2026-09-11 — The instance wiped and re-seeded, and the four things a clean fixture exposed

**Ticket:** none — the operator's call, taken after PF-012 recorded that three solutions could not
be removed through any API (Q-029).
**Status:** done. **308 pass, 0 fail, twice in a row — and the fixture is byte-for-byte unchanged
after both runs**, which is the result worth having rather than the green tick.

**What was done.** `docker compose down`, then `mysql_data`, `api_storage` and `worker_cache`
removed, then `up -d`. The api entrypoint's fresh-database path does the rest on its own: schema
from the current entity mappings with the 144-migration history marked applied, `db:fill init` for
the admin account and the hardware group, and `runtimes:import` for each language package — four
environments with working pipelines. Then `pnpm seed`.

**`api_storage` had to go with the database, and that is the one thing easy to get wrong here.** The
entrypoint's guard is `[ ! -f storage/.seeded ]`, and `storage/` is that volume — so wiping only
`mysql_data` would have skipped `db:fill init` and `runtimes:import` entirely, leaving a schema with
no admin account and no runtime environments. It also holds every uploaded solution and attachment,
which a fresh database has no rows for.

**A backup was taken first** (`mysqldump` plus a tar of `api_storage`, ~350 kB together), because
the wipe was not only the seed's data: it also took an operator's own `Katedra informatiky`,
`2025/2026 - Jazyk python` and `Jazyk Python` groups, a hand-written `01 - RPN` exercise, three real
accounts, and the second instance. That was put to the operator with the list before anything was
removed, and the answer was to go ahead.

**What the wipe fixed by itself:** one instance instead of two, so nothing has to guess which one
the landing page names; 34 soft-deleted instances and 14 orphaned probe accounts gone; the stray
`[seed] Echo Greeting` attachment in somebody else's course gone; and the three undeletable
solutions of Q-029 gone with the tables that held their plagiarism records. `pnpm seed` on the fresh
database now logs "no unintended seed solutions to remove" and nothing is refused.

**And then four failures that only a clean fixture could show**, every one of them a real fault that
dirty data had been masking:

**1. A spec insisted on a plural the fixture does not promise.** The group-wide drill-down summary
reads "3 submissions across 1 assignment." for the seeded student — all three of her attempts are on
one assignment, deliberately — and the assertion required `assignments`. It had been passing only
because a stray solution of hers sat on a second assignment. The count across more than one is
asserted further down, on the classmate, who genuinely has that.

**2. The teacher dashboard's two queues could not both be read by one person.** "Reviews you have
open" is the reviews _this reader_ started; "Reviews students have asked for" is the requests in
groups _this reader_ supervises. The seed opened its review with the **admin** token, and the admin
supervises nothing, so no single account had both — it had only ever worked because earlier runs had
left the admin attached to the seeded groups. The seed opens it as **Sam**, the group's own
supervisor, which is also who would really be reading it.

**3. PF-010's last bucket is real, and both earlier readings of it were wrong — including mine, one
commit before this.** `getByPlaceholder("Filter groups")` is a strict-mode violation because the
document holds **two** identical inputs: one under `main#main-content` and one under `div#S:2`,
React's out-of-order streaming staging area, which an inline script relocates into place afterwards.
So it is not the responsive duplicate the row guessed, and it is not "impossible because
`data-table.tsx` renders one input", which is what I concluded from reading the code and which
`groups.spec.ts` refuted on the next fresh instance. It is a **race with PF-002's streaming**, which
is exactly why it appeared on some instances and not others. Scoped to `main`, and recorded as
**DEC-134** because every unscoped locator in the suite has the same exposure.

**4. A product defect that had been hiding behind an intermittent spec.** `refusals.spec.ts` kept
failing about one run in three with "Something went wrong" where the Not found page belongs — which
I had attributed to Q-030's authorless solutions, and the fresh instance has none, so that was
wrong. The real cause: `ProfileView` awaits three reads of the same user in one `Promise.all`, and
`getUserGroups` uses the raw client on purpose so that a **403** can be rendered around. It rethrew
everything else — including a **404** — as a plain `ApiError`, while its two neighbours raise
`notFound()`. `Promise.all` rejects with whichever settles first, so **the reader's answer for a
nonexistent user was decided by a race between three requests**, and one of the three was wrong.
The carve-out is now 403 and only 403. The assertion that used to wait five seconds and fail now
resolves in 305 ms, and passed four repeats.

**Also found on the way, and it belongs to DEC-133 rather than to a ticket of its own.**
`AssignmentSolution::setReviewedAt()` clears `reviewRequest` whenever a review is **closed** — in
the entity, so it is in no presenter and in no response — and erasing or reopening the review does
not put it back. `solution-sources.spec.ts` closes a supervisor's review on the very solution the
request fixture lives on, so it had been consuming that fixture every single run, and the dashboard
spec failed in the other worker when it did. It restores it explicitly now. Found by bisecting: set
the flag, run one spec file, read the flag, repeat — eight files, and the answer was unambiguous.

**The evidence that the suite no longer eats its own fixtures** is not the two green runs on their
own. It is that after both of them the seeded group still holds exactly four solutions on the
primary assignment, one on the second-deadline one, **zero on the "nothing submitted yet" one**, and
the review request still standing — the state `pnpm seed` had left. Nothing leaked either: no
orphaned broadcasts, 27 exercises, 9 pipelines, 7 groups, no authorless solutions.

---

### 2026-09-11 — PF-014, PF-015, X-001, and a question re-checked against the framework's own docs

**Tickets:** PF-014, PF-015, X-001 (all new/closed), Q-016 re-checked.
**Status:** done. **313 e2e pass, 0 fail** (308 before, plus X-001's five), five static checks and
**287** unit tests green.

The backlog had nothing unblocked left after the wipe, so this session's work came from three
places: the leak class PF-007 and PF-011 had each fixed for one entity, a performance item PF-009
had named and left, and X-001 — the one remaining product idea, and the one the operator actually
needs, since GitHub Classroom is being retired.

**PF-014 — four more creators clean up only when they pass.** `e2e/helpers/created.ts` is now the
shared tracker and the two existing ones delegate to it, which is what made the other four cheap to
find: `users.spec.ts` creates a real account and deleted it after its last assertion;
`group-create.spec.ts` and `instances.spec.ts` used `try`/`finally`, which a Playwright timeout
skips; `group-invitations.spec.ts` swept leftovers at the _start_ of the one test that makes them;
and `solution-sources.spec.ts` starts a supervisor's review and erased it at the end — that one bit
its own next run rather than a neighbour's, because there is no "Start review" button when the
review is already open, and it is how the whole group was noticed.

**`instances.spec.ts` was the worst, and not because of the `finally`: its teardown drove the
page.** A test killed by a timeout could not run it at all, so it left an instance _and_ the root
group that deleting an instance orphans (Q-023) in every superadmin's sidebar. Every tracker writes
through core-api now, which is the only kind of teardown that works when the page is what died.

**Proved rather than asserted.** A throwaway spec created an instance and an account and then failed
on purpose. Both were gone afterwards: live instances back to 1, live groups back to 7 (so the
orphaned root group went too), the account soft-deleted — which is the only delete core-api has
(Q-021).

**PF-015 — a markdown code fence still shipped a style attribute per token.** PF-009 named this and
left it, because a fence's HTML is generated by `rehypeShikiFromHighlighter` and never passes
through `CodeLine`. Measured through the running app on a 42-line Python fence in a real exercise
text: **239 inline `--shiki-light` declarations, 11,996 bytes**, and not one palette class. After:
one inline declaration and 238 classes, and the document **113,797 → 98,106 bytes — 15.3 kB, 13.5%
off**. That is more than the attribute arithmetic predicts (~7 kB) because the style objects were in
the embedded RSC payload as well as in the markup, so removing them counts twice — the same double
saving PF-003 and PF-009 measured on the viewer.

**Two things there only a live check caught, and both are the kind that passes every static gate.**
The `<pre>`'s own `--shiki-*` pair is the block's _background_, not a token, so it stays inline — one
attribute against hundreds, and filing a background under a name that means "a token of these
colours" is a collision waiting to mean the wrong thing. And `@shikijs/rehype` writes
`properties.class` while hast's canonical key is `className`, which react-markdown prefers once both
exist — so writing only `className` **replaced** `<pre class="shiki">` rather than adding to it.
Typecheck, lint and the unit tests were all happy; two specs failed, which is what the suite is for.

**X-001 — the GitHub Classroom importer, built in the narrow form its own write-up argued for.**
`lib/import/classroom.ts` is pure and has 18 unit tests; the screen runs it in the **browser** and
shows the report before any endpoint is called (DEC-136). What maps is a Classroom test with
`input`/`output` and a byte-exact comparison — that _is_ a ReCodEx test with the `diff` judge. What
does not is named test by test, in words, on the screen: a regex comparison, a `run` a framework
decides, a test with neither input nor output, a dropped `setup`, and a containment comparison
**approximated** by the token judge with the difference stated rather than absorbed. The exercise it
creates is deliberately not assignable, because core-api refuses one with no reference solution
(T-011) and a template carries none — so the screen says that too. No API change: every endpoint it
drives is one an existing screen already drives.

**The tests found two bugs in the parser and the integration found three more.** The unit tests:
`\bg\+\+\b` never matches, because a word boundary needs a word character on one side and `g++ ` has
none — so every C++ template guessed no language; and diacritics were being _dropped_ rather than
folded, which is `ov-sou-et` against `over-soucet` on a Czech deployment. The integration, and only
a live read of a working exercise's configuration: a test's variables nest inside `pipelines[]`
rather than sitting on the test, a test is named in the configuration by its **numeric id**, and an
environment with an empty `variablesTable` declares no `source-files` — so the first hand-written
draft of the action would have produced an exercise whose submit form had no language to offer,
which is the trap the seed's own comment describes at length. Rewriting the action to go through
`updateExerciseConfig` removed all three at once, because that function already resolves the
environment's pipelines and asks core-api which variables each declares.

**What the e2e spec asserts is the configuration, not the form.** Five tests: a file that maps
cleanly, a file where half of it does not (asserting the _reasons_), a file that is not one at all,
a real import, and that it is not a student's screen. The real import reads the written configuration
back **through core-api** and checks that each test carries its own `stdin-file`, its own
`expected-output` and the `diff` judge — which is the difference between an exercise that has tests
and an exercise that grades. The draft it creates is removed by PF-014's tracker.

**Q-016 re-checked against Next 16.3's bundled documentation, and there is nothing to do.** The
framework documents the 200-instead-of-403 as an accepted trade-off, in the same words and with the
same two remedies the question had reasoned out unaided. What the entry was missing is the
mitigation: **Next injects `<meta name="robots" content="noindex">` itself**, verified in this app's
own served HTML — `/en/users/<nonexistent-id>` and `/en/admin` read by a student both answer
`200 OK` carrying `NEXT_HTTP_ERROR_FALLBACK;404` / `;403` _and_ the noindex tag. So the permanent
half of the cost is already paid for; what remains matters only to a non-browser client, and the
trigger for revisiting it is now written down.

**F-028 was re-checked yesterday and nothing has moved**, so the backlog's only open rows are it and
the two open questions this session did not close (Q-029, Q-030), both of which are core-api's to
answer rather than ours.

---

### 2026-09-11 — PF-016: a submission is actually graded, for the first time

**Tickets:** PF-016 (done), PF-017, Q-031, Q-032, DEC-137, DEC-138 (all new).
**Status:** done. Five static checks and **287** unit tests green. **The seeded fixtures carry
genuine verdicts**: `[seed] correct` 10/10 with Test 1 OK, `[seed] wrong` 0/10 FAILED, and
`[seed] multi-file`, `[seed] borrowed` and `[seed] second try` 10/10 — the first real evaluation
this deployment has ever produced.

This came from the compose repo's plan 002, whose step 1 was a discriminator: configure the same
exercise through this app's own screens, diff it against the seed's, and let the answer decide
which repository the work lands in. It landed entirely here, and **the discriminator did not decide
it on its own** — the two configs differ, but rewriting the seeded exercise through T-009's editor
and re-running the solution produced a byte-identical job. An assignment holds a _snapshot_ of its
exercise (which `ensureAssignmentSynced` already knew, for the environment config), so nothing
moved until the assignment was synced. With that done it came apart into three faults.

**1. `source-files` was an array where ReCodEx wants a scalar.** The seed wrote
`{type: "file[]", value: ["*.py"]}`. core-api's `VariablesResolver::resolveFileInputsRegexp`
returns the variable untouched when `isValueArray()` is true, so the wildcard was never matched
against the submitted names and the compiled job read
`cp ${SOURCE_DIR}/*.py ${SOURCE_DIR}/Test 1/*.py` — a file literally called `*.py`. The type is an
array and the value is **one pattern**: that is what ReCodEx's own python3 runtime declares in
`defaultVariables`, and exactly one pattern is possible, which is a design limit worth knowing.

**2. A test needs both of the environment's pipelines.** Only
`Python execution & evaluation [stdout]` was attached. Its `source-files` is an _input_ that a
preceding pipeline binds, and Python's "compilation" is `Compilation source files pass-through` —
a no-op whose whole job is to bind it, which is why leaving it out looked harmless. `entry-point`
was `""` rather than the `$entry-point` sentinel, which is what rendered the run as
`python3 <runner> ${EVAL_DIR}/`. **Two bugs, not one** — the question plan 002 left open.

**3. And a third that fixing the first two exposed, which is the one that mattered to the
product.** The sentinel makes the entry point a _submit-time_ variable, and core-api refuses a
submission that does not carry it — with one file or twenty. Legacy sends `solutionParams`; this
app never did. So the seed fix alone would have broken S-014's submit screen, and the gap was
invisible only because no exercise here had ever asked for the variable. `preSubmitSolution` now
reports which environments ask, the form resolves the value legacy's way and the action sends it
(**DEC-137**). **The same gap was in T-011's reference-solution form**, and it was the e2e suite
that found it rather than review -- that form submits through its own action, which nothing had
reason to look at while no exercise demanded the variable.

**The ZIP fixture could not survive the fix, and is better for it (DEC-138).**
`Solution::getFileNames()` reports the uploaded name, not the entries inside, so `solution.zip`
matches no `*.py` pattern and core-api refuses the submission outright. It never graded either —
the broken config skipped matching altogether. It is `main.py` + `greeting.py` now, which keeps
what G-005 and G-030 used it for, grades, and is the only fixture that reaches DEC-137's picker.
**The entry point is the first file listed, not the first by name:** `greeting.py` sorts before
`main.py`, so deriving it the way the form does seeded a solution that imports the program and
never runs it — found as a fixture scoring zero, which is what a verdict being real is good for.

**What the working sandbox costs the suite, filed as PF-017.** `mintSubmissionFailure()` re-ran a
seeded solution and relied on every job failing within a second. A re-run is evaluated now, so it
returns `null` and two tests skip with a reason instead of waiting twenty seconds. Minting one
takes a hardware group no worker serves and this deployment defines one; the fixture needs a
decision, not code.

**Two core-api defects, filed as Q-031 and Q-032**, both found by clearing up after the
investigation rather than by looking for them. Deleting a solution a plagiarism record points at
answers 500 **after** removing the stored files, leaving a solution whose file listing is intact
and whose bytes are gone — and `/plagiarism` has no delete route, so it can be neither repaired nor
deleted through the API. It hit `[seed] correct` and `[seed] borrowed` here, and clearing two rows
directly in the database plus a re-seed is what recovered them; four e2e tests were red in between,
for damage rather than for a regression. And a submit refused at compilation still leaves its
`Solution` row behind.

**What the suite had to give up, and it is the change working.** Five specs asserted the broken
state in so many words, which plan 002 predicted: `solutions.spec.ts` and
`reference-solutions.spec.ts` each had a test whose whole subject was "Isolate init error" and now
assert the verdict a reader actually gets; `groups.spec.ts`'s points matrix told apart the
"everything failed" glyph and "nothing submitted" and now tells apart a score and "nothing
submitted". `solution-diff.spec.ts` took **the first two attempts**, which stopped sharing a
filename once the multi-file fixture became a third — named now, which is PF-010's own lesson one
spec further. And a **sixth entity joined PF-014's tracker**: the reference-solution submit test
deletes its solution as its last assertion, so a failure before that left the _supervisor_ one of
their own — and the next run's "a colleague's private answers are not this reader's" then read a
list with a row in it and failed on the fixture rather than on the app. It is tracked by
description, for PF-014's reason.

**One new test rather than only repaired ones:** the entry-point picker had no coverage at all,
being new UI on a path nothing had exercised. `assignments.spec.ts` now uploads two files, asserts
the submit is **blocked** until the question is answered, answers it, and checks the solution passed
— which it only can if the file it named is the one that ran.

**One failure seen once and not explained, recorded rather than chased.**
`solution-verdict.spec.ts`'s "awards points the evaluation did not" failed in one full run and
passed in two later full runs, on its own, and paired with the spec that now shares its fixture.
The suspicion was this session's own doing — `solutions.spec.ts` now reads `[seed] correct`, which
that spec writes to, and DEC-133 is exactly about sharing a written fixture across two workers —
but it does not hold up: the read asserts the evaluation table, which a points override does not
touch, and a GET cannot disturb the writer anyway. So it is left alone and written down: if it
recurs, `[seed] correct` has several readers now (`plagiarism`, `dashboard`, `solutions`) and one
writer, and that is where to look first.

---

### 2026-09-11 — PF-017 answered: the fixture cannot be built, and that is the finding

**Tickets:** PF-017 (closed, not a defect).
**Status:** no code changed. Two candidate fixtures were investigated against the running stack and
both are closed, so the three skipped tests in `submission-failures.spec.ts` keep their skips.

The row asked for a decision between two ways of minting a submission failure now that the sandbox
works. Neither survives contact.

**A hardware group nothing serves cannot be created.** `/v1/hardware-groups` is a single `GET`
route — there is no create, update or delete anywhere in core-api's router. The only group that
exists, `01-default`, comes from `fixtures/init/10-hwGroups.neon`, so a second one means patching
an upstream fixture or inserting a database row by hand. That is deployment surgery performed to
give a test suite something to look at, and the result would sit in every exercise's limits screen
for as long as the deployment lives.

**A job whose supplementary file is missing is refused before it is dispatched.** Tried directly:
an exercise was built, given an `expected.txt`, and the file deleted afterwards. The next
submission answers `Exercise is broken. If you are the author, check its configuration.` — core-api
checks the configuration it is about to compile and declines. That is the right behaviour and it is
not a submission failure.

**What is left is the definition of the thing.** A submission failure is what core-api records when
the _broker or the worker_ could not process a job it accepted: no worker for the hardware group, a
file the worker cannot fetch, a worker that dies. None of those is reachable from an API a spec can
call, which is exactly why the old fixture was a side effect of a broken sandbox rather than
something anybody built.

**So the screen keeps the coverage that does not need a row** — it opens on the unresolved queue,
it is refused to a reader core-api does not trust, and an empty queue renders honestly, which is
now this instance's ordinary state. The three tests that need a row say why they cannot run.

**One real failure was made on the way and has been resolved through the product**, with a note
saying what it was: importing the C# runtime package by hand through `docker compose exec` runs as
root, and php-fpm serves as `www-data`, so the imported blob was unreadable and the worker's next
job failed to fetch it. The compose repo's `COMPATIBILITY.md` carries that step now.

---

### 2026-09-11 — a wipe-and-reseed, and the five tests it caught

**Tickets:** none new; the compose repo's plan 003 gained its real verification.
**Status:** done. **311 e2e pass, 3 skip, 0 fail**, twice, against a database built from nothing —
and the seeded fixtures are **unchanged** after both runs.

The instance was wiped to earn the stronger verification the previous verified set had and this
one did not. Three things came out of it.

**The seed produces correctly graded fixtures from nothing.** `[seed] correct`, `[seed] multi-file`,
`[seed] borrowed` and `[seed] second try` all score 10/10 with `Test 1` OK, `[seed] wrong` 0/10
FAILED, and the reference solution 1.0 — straight from `pnpm seed`, with no repair by hand. That is
what says PF-016's fix is in the script rather than in one instance's data.

**Five tests hardcoded the instance's name**, and the compose repo's plan 003 had claimed none did.
That claim was checked against `landing.spec.ts` — which PF-010 had already fixed — and generalised
from one file to the suite. `instances.spec.ts` (three tests), `groups.spec.ts` and
`command-palette.spec.ts` all said `Frankenstein`, because **an instance's name is also its root
group's**, so it appears in the group list and in search as well as on the instances screen. They
read it through a new `instanceName()` helper now; the command palette searches the **seeded group**
instead, which is a fixture this suite owns rather than something an operator names. `exact: true`
came with it — the seeded group has a subgroup whose name contains its own.

**And the fixtures survive the suite.** Snapshotted before and after a full run and compared: four
solutions on the primary assignment, one on the second-deadline one, none on the deliberately-empty
one, one instance, six groups, 26 exercises, an empty failure queue. Identical.

---

### 2026-09-11 — the cutover, and two races only real verdicts could expose

**Tickets:** none new; the compose repo's plan 004 moved `/` to this app.
**Status:** done. Five static checks, 287 unit tests, and the full e2e suite green.

The deployment serves this app at its own address now, so every legacy URL needed somewhere to go:
`next.config.ts` gained the `redirects()` block `docs/ROUTES.md` has been carrying, and **two of its
rules were written as gaps** — `/app/assignment/:a/solution/:s/diff/:other` and
`/app/shadow-assignment/:id/edit` were recorded as having nowhere to land "until those are built",
and G-005 and G-009 built them.

**One rule from that table is deliberately not here, and the reason is the interesting part.**
`/login/:redirect*` matched bare `/login` and redirected it to `/login` — a permanent self-redirect
on the one route an unauthenticated visitor must be able to reach, and exactly where this app's own
logout lands (F-017 303s to the locale-neutral `/login`). `account.spec.ts` and
`session-expiry.spec.ts` both caught it as a login page that would not load.

**The diagnosis went wrong first, and that is worth recording.** Removing the rule appeared not to
fix it, which nearly sent the investigation somewhere else. The fault was the harness: those probes
ran against `pnpm start`, which Next itself warns does not work with `output: standalone`. Driving
the same paths through the **container** was unambiguous — without the rule `/login` answers `307
/en/login`, with it a 308 loop. Redirects are verified through the container from now on.

**And a genuine test race, newly reachable because the fixtures now grade.**
`solution-verdict.spec.ts` clicked "Award full marks (10)", waited for `10/10` in the summary, then
typed `3` into the override field. Since PF-016 the seeded solution _already_ scores 10/10, so that
assertion resolves before the save round trip finishes — the typing landed while `router.refresh()`
was in flight, the re-render put `10` back, and the next save sent the wrong number. It waits for
the **field** to carry the awarded value now, which is the honest signal that the save completed.
This is the failure that looked like a flake earlier in the day and was not: it only became
deterministic once every seeded solution had a real verdict.

---

### 2026-09-12 — every environment grades, and the API defects are written up for the ReCodEx team

**Tickets:** none new. `RETROSPECTIVE.md` §1 gains three entries; the compose repo carries the
worker fix and the verification.
**Status:** done. Five static checks and 287 unit tests green; no product code changed here.

**All six runtime environments grade**, verified one exercise at a time on the real stack and then
deleted: `bash`, `c-gcc-linux`, `cxx-gcc-linux`, `python3`, `cs-dotnet-core` and `java`, each 1.0
with `Test 1` OK. That finishes the question plan 002 left open about C#, and answers it for the
other four at the same time.

**C and C++ had never compiled on this deployment**, and nothing could have noticed until a
submission reached a compiler. Their pipelines hardcode `/usr/local/recodex-gcc/bin/gcc`, which is
where ReCodEx's own production images build one; this image has Debian's in `/usr/bin`. The compose
repo's worker Dockerfile links the expected path at the real one — rather than editing a pipeline
that the next `runtimes:import` would overwrite. Third of its family, after the sandbox's `PATH`
and the `/opt` binding: **a toolchain the sandbox cannot reach at the path its runtime package
names, which reads like a missing toolchain every time.**

**Three API change requests were added to `RETROSPECTIVE.md` §1**, which is the document the
ReCodEx team can act on. Two are new (a submission refused during job compilation keeps its
`Solution` row; a solution whose author was deleted makes the view factory throw), and one
**escalates Q-029 rather than repeating it**: deleting a solution that plagiarism detection has
touched does not merely fail with a 500, it removes the stored files _first_, leaving a solution
whose file listing is intact and whose bytes are gone. That is data loss behind a refusal, and it
was found by hitting it twice rather than by reading. The section's own count was corrected on the
way — it claimed twenty-three while listing twenty-four.

---

### 2026-09-12 — the suite is pointed at the deployment, and finds two things that only exist there

**Tickets:** PF-018, PF-019; **PF-020** filed. **Status:** done. Five static checks, 288 unit
tests, and **312 e2e pass, 3 skip, 0 fail through the deployment's own address** -- which is the
part that is new. The suite had never been run through the proxy before.

The operator asked whether the new frontend was ready to be tested properly. Answering it meant
running the suite where they would actually click, rather than where it has always run, and that
alone produced both defects below. Neither is reachable from a development machine.

**The proxy was swallowing this app's own `/api/` routes (PF-019).** `location /api/` has sent
`/api/` at core-api since long before this app existed, and the cutover deliberately left it alone
-- plan 004 reasoned that "the new app calls core-api through the public URL", which is true and
beside the point: **every Route Handler this app owns is under `/api/` too.** `/api/auth/login`
answered `404` with `X-Powered-By: Nette Framework 3`, so **nobody could log in through the
deployment's address at all**, while the same container on its own port was fine. The e2e suite
never saw it because it drives the app directly -- plan 004's step 5 says so in as many words, and
that sentence is the whole blind spot. Narrowed to `location /api/v1`, which is all of core-api's
public surface: `services/web-app/env.json.template` and this app's `API_BASE_PUBLIC` both address
it that way. The diff went to the operator before it was committed, per constraint 1.

**Every date typed into a form was being read in the server's zone (PF-018).** The container runs
UTC, a reader's browser here runs Europe/Prague, and a `datetime-local` string carries no offset --
so `new Date("2026-09-12T06:41")` is 06:41 in whichever zone the process happens to be. Five Server
Actions resolved that string themselves: **a deadline typed as 12:00 was stored as 14:00**, and the
same for system-message windows, invitation expiries, licence validity and shadow points.

`lib/format/datetime-local.ts` has stated the rule since S-008 -- both conversions happen in the
browser -- and `assignment.schema.ts` claimed in a comment to be following it. The forms convert
now and hand their actions unix seconds, which are the same instant everywhere; S-008's exam window
turned out to be the one surface already doing it right (`examFormToPeriod` runs in the browser),
and it is the shape the other four were rewritten into.

**What makes this one worth reading twice is why it was invisible.** Typecheck, lint and build all
pass either way -- the types are identical. The e2e suite ran against a local `next start`, whose
zone _is_ the browser's, so the wrong parse and the right display cancelled exactly. It reproduces
only where the server's zone differs from the reader's, which is every real deployment and no
development machine. So the guard is structural rather than per-call-site:
`lib/actions/datetime-boundary.test.ts` asserts that **no `"use server"` module mentions
`fromDateTimeLocal` or `Date.parse(` at all** (32 server modules scanned; it would have failed on
five of them). Alongside it, one e2e spec now types a deadline, saves, reopens and reads the picker
back -- the check no spec was making, on the field that matters most.

**One honest correction on the way.** The first pass at listing what was affected named the exam
window on the strength of a grep for `fromDateTimeLocal` in `group-exam.schema.ts`. Reading the
call path showed the opposite: the action re-validates with `examPeriodSchema`, which is already
unix seconds, and the client converts. Exams were never affected.

**`INVENTORY.md` is unchanged deliberately** -- both of these are defects in rows that were already
`done`, and neither changes what is reachable.

**And verifying the fix turned up its display half, which is filed rather than folded in.**
`toDateTimeLocal` also runs during SSR -- a client component is rendered on the server too -- so a
picker's _initial_ value arrives in the server's zone and hydration corrects it a moment later.
Fetched from the deployment directly, the assignment edit page ships `value="2026-09-15T00:42"` for
a deadline that is `02:42` here. Nothing is stored wrong (a submit happens after hydration, and the
conversion on submit is now right), but footgun 6 calls a hydration mismatch an error, and seven
components initialize a picker this way. That is **PF-020**, taken in the same session and closed below.

The suite runs against the deployment's address from now on.

**PF-020, closed the same day, and the seven turned out to be two.** The hook is
`lib/format/use-datetime-local.ts`: the field starts empty, which is true in every zone, and takes
its value in an effect that runs **once** -- the parent re-renders after a save, and re-seeding
then would discard whatever the reader had typed since. `assignment-form` and
`shadow-assignment-form` use it.

The row's own claim of seven components was wrong, and it was wrong because it was arrived at by
reading imports. Fetching each page's HTML instead shows the other five never ship a time:
`invitation-manager`, `shadow-points-table` and `message-manager` seed a picker from a click,
`exam-form` mounts its dialog closed so the defaults are computed in the browser, and
`licence-manager` has no seed at all. The same correction as the exam window earlier in the day --
a grep names candidates, the call path decides.

The guard is a spec that reads the **raw HTML** of the edit page and asserts no `datetime-local`
carries a value, with a second assertion that the rendered picker does carry one. That split is the
point: this defect is invisible in a rendered page, because hydration has already corrected it
before anything can look.

**313 e2e pass, 3 skip, 0 fail** through the deployment's address, with the five static checks and
288 unit tests alongside.

---

### 2026-09-12 — the product documents itself, on the front page

**Tickets:** X-002, DEC-139. **Status:** done. Five static checks, 288 unit tests, and **318 e2e
pass, 3 skip, 0 fail** through the deployment's address -- five of them this ticket's own.

The operator asked for documentation -- how to install the thing, and how to use it -- and then for
it to live on the frontend with a signpost from the front page. So it is three guides, one per
audience the product actually has: **installing and running the deployment**, **running a course**,
and **submitting your work**. Six documents, because both locales are not optional here.

**They are public.** The FAQ already established that the anonymous route group is where a document
belongs, and the reasoning is stronger for these: whoever is deciding whether to install this has
no account by definition, and requiring one to read how to get an account is a circle.

**The text is markdown in this repository (DEC-139), not entries in `messages/`.** A catalogue is
for interface strings; a guide is a document, and as JSON it would be one escaped line that nobody
can review in a diff. They render through the same server-side `Markdown` component as an exercise
text, so a table or a fenced `docker compose build` reads the way tables and fences read everywhere
else in the product.

**Three things only the real container could have shown, and it showed all three.**

- **The standalone build does not trace what nothing references statically.** The guides are read
  from disk at request time, so Node File Trace has no way to know they exist:
  `next.config.ts` names `content/docs` in `outputFileTracingIncludes`. Without it every guide
  renders "could not be loaded" in production and perfectly in development -- the same shape of
  defect as this morning's timezone bug, invisible exactly where it is tested.
- **`PUBLIC_PATHNAMES` is an exact-match set.** `/docs` would have been public and `/docs/install`
  behind a login. A prefix, rather than three more literals, so a fourth guide needs no edit here.
- **The page had two `h1`s.** `PageShell` renders one from the catalogue and each document opened
  with its own `#`. The documents start at `##` now, and the spec asserts the count rather than the
  text -- the title is maintained in one place, which is also what names the guide in the
  breadcrumb, the browser tab and the signpost.

Verified against the deployment: both locales of all three guides, the signpost from `/`, the
markdown rendering as markdown, and a slug that is not a guide answering the 404 body Q-016
describes.

---

### 2026-09-12 — the product has its own name

**Ticket:** X-003. **Status:** done.

The operator settled the name after a round of candidates: **UPolníček**. It is not a new coinage
-- the department already ships a Visual Studio extension by that name that submits assignments, so
the word already means "where homework goes" to the people who will use this. `úkolníček` is a
homework notebook, which is the thing the operator actually asked a name to convey; `CodeUP` and
`UPload`, the other two finalists, needed a subtitle to say the same.

**One measured advantage decided it.** Czech declines the name. Seventeen strings say `v ReCodExu`,
`do ReCodExu`, `API ReCodExu`, and an indeclinable name like `CodeUP` would have meant rewriting
every one of those sentences around it. `UPolníčku` simply replaces `ReCodExu`.

**Three classes of mention, separated by hand rather than by `sed`.** This is the whole of the
work, and a blind find-and-replace would have got all three wrong:

- **This product** -- 62 strings per locale, the `global-not-found` title, six guide documents,
  six e2e specs asserting on visible text. Renamed.
- **Upstream ReCodEx** -- the footer credit, the FAQ's default wiki URL, and every code comment
  that explains core-api or the legacy app. Unchanged, because they are about a different piece of
  software that still exists.
- **Seed fixture data** -- `Hello, ReCodEx!` is the seeded exercise's expected output, written into
  `expected.txt` and into its reference solution. Renaming the constant would have left the
  fixture ungraded until a re-seed, which is PF-016's lesson arriving from a different direction.
  Left alone, deliberately.

**The footer carries the three things the operator asked for**: that this extends ReCodEx (with
the Charles University credit intact), that KI PřF UP develops it, and the MIT licence. The
"Source code" link pointed at upstream and now points at this repository -- it was already wrong
before the rename, and the rename is where it became visible. `LICENSE`'s copyright line moved to
the university; the attribution paragraph below it was already accurate and stayed.

The browser tab says **UPolníček — odevzdávání úloh** rather than the bare name: the operator's
original question was how a student knows what the tool is for, and the answer was never the name
alone.

**PF-021 came out of the same run, and it is not the rename's.** `system-messages.spec.ts` had
failed once before today and passed alone and in two full runs afterwards, so it was left as a
flake; this run made it twice in five, which is a pattern rather than an accident.

The assertion that failed says a deleted broadcast is still on the dashboard, which reads like
caching -- and two measurements said otherwise. The banner's own read goes through the `no-store`
client, and a probe against core-api created a message, deleted it, and asked `/v1/notifications`
again at 0, 250, 500, 1000, 2000 and 4000 ms: gone every time. The API is immediately consistent.

What was actually wrong is one line in the spec's cleanup: `if ((await row.count()) === 0) return;`.
`count()` does not auto-wait, the management page streams, and under the suite's load the rows
arrived after `goto` resolved -- so the cleanup deleted nothing and said nothing, because deleting
nothing is also its correct behaviour when the message is already gone. It waits for the table
first now. **Fourth of that family**, after PF-007, PF-011 and PF-014: every one of them a cleanup
whose failure mode is silence.

---

### 2026-09-12 — the public copy, after the first round of real testing

**Ticket:** X-004. **Status:** done.

The operator started testing and the first thing he sent back was the landing page: vague, reads
like an unfinished thing rather than a faculty's product. He quoted the tagline — _"Procvičujte
programování a hned se dozvíte, jestli to funguje."_ — and he was right about more than he said.

**Three faults, one of them mine from this morning.** The tagline is the only place in the whole
app that claims this is about practising programming: an imperative, addressed to students alone,
silent on submission and deadlines. `what`, `quickStart.exercises` and `quickStart.solutions` all
assume the submission is source code — which **stopped being true the same day**, when
`data-linux` went in. And deadlines had no section at all.

**His correction is worth recording, because I had the facts wrong.** The plan said the landing
page "is silent about deadlines" as though the product only listed them. It does more:
`components/dashboard/deadline-calendar.tsx` renders a real month grid of every deadline a reader
has, in the groups they study in _and_ the ones they teach, beside the "coming up" list. The new
section names the calendar instead of describing a list, because the page should say the true and
more useful thing.

**One behaviour change, not just copy.** An instance with no description used to announce it —
_"Tato instance se nijak nepopsala."_ He asked where the description is filled in, and the answer
is that it belongs to the instance's **root group** and is edited there (`POST /instances/{id}`
takes only `isOpen`; the app says as much in `Instances.about.nameLivesOnGroup`), or once at
creation, or from `RECODEX_INSTANCE_DESCRIPTION` on first boot. None of that is a visitor's
business, so the line is gone and the section simply ends at the instance's name.

**The tagline went through two drafts, and the second was his catch too.** _"…evidenci termínů a
jejich hodnocení"_ binds `jejich` to `termínů` — "grading deadlines". Reordered so it sits against
`prací`.

**The guides gained what the day had taught them and they had not**: data-only exercises accept any
file, and their judge is _not optional_ — without one every submission fails with
`/box/: Is a directory`, on an exercise that looks correctly configured.

Deliberately untouched: the group and assignment copy, which is specific and correct and would only
have churned; the FAQ's error string, which mirrors the legacy app's own sentence on purpose; and
everything behind the login, which the operator scoped into its own pass.

**Second round on the same page, from the operator reading it rather than from me.** Four sections
became four different verdicts, and two of them were "this does not belong here at all":

- **Skupiny** — reworded to his own framing: groups organise teaching into self-contained units.
- **Úlohy** — his text, near enough verbatim: a template of two parts, the task and the rules a
  submission is judged by, with programming exercises getting tests, resource limits and automatic
  grading and everything else getting the teacher. The sentence about an exercise being invisible
  until assigned went with it: **that is documentation, not a front page.**
- **Zadání** — removed. "Není vůbec jasná" was the verdict, and a section nobody understands is
  worse than a gap.
- **Body bez odevzdání** — removed for the same reason. Shadow assignments are a real feature and
  still documented; they are not how you explain what the product is.
- **Dokumentace** — removed, because the call to action for it is already in the header. The link
  was the only thing in that section doing any work.

Also `Tato instance` → `Instance`. The remaining four sections read groups → exercises →
solutions → deadlines, which is the order somebody meets them in.

**One thing worth recording about how this nearly went wrong.** The first attempt to shorten the
`sections` array silently did nothing: Prettier had reflowed it across six lines between the two
edits, so a replacement written against the single-line form matched nothing. Typecheck, lint and
the catalogue test all stayed green, because the sections are read as `t(\`quickStart.${section}\`)`
— a template literal the catalogue scanner cannot resolve, so the removed keys were not missed by
anything except the page itself at run time. Caught by looking at the rendered page. **A dynamic
message key is outside every static check this repo has**, which is worth remembering the next time
one is introduced.

---

### 2026-09-12 — the FAQ is removed, because it was somebody else's

**Tickets:** DROP-C06, X-005 filed. **Status:** done. Five static checks and 281 unit tests green.

The operator asked for the FAQ's first paragraph to be reworded: point a reader with a specific
problem at their teacher at KI PřF UP. **The paragraph was not ours to edit**, and reading what it
actually said changed the instruction.

`FAQ_URI` fetches the document, and unset — which is how this deployment runs — it defaults to
ReCodEx's own wiki. That document opens:

> Please note that this FAQ also contains specific information that apply only to our pilot
> instance of ReCodEx at MFF-UK. If you have a specific problem with this instance, contact the
> administrator (`recodex@mff.cuni.cz`).

So our students were being sent to **another university's administrator**. Below it: CAS
authentication at Charles University, LDAP records at `ldap1.cuni.cz`, SIS group binding — none of
which this deployment has (Q-004 established there is no CAS here at all) — and the whole thing in
English, on a page a Czech student reads. Told this, the operator's instruction became: hide it
entirely, we will write our own.

**What removal actually touched**, since a public capability leaves marks in more places than the
page: the route and its loader, the landing page's call to action, the sidebar link G-031 added,
`proxy.ts`'s public list, the breadcrumb manifest, the `Faq` namespace in both catalogues, the
public-route list the route specs walk, `faq.spec.ts` and the app-shell spec's own FAQ test. Nine
files and two deletions, and the registers that exist for exactly this: `DROPPED.md` DROP-C06,
`INVENTORY.md`'s row, `ROUTES.md`'s row.

**One thing only a deletion could have exposed.** `tsconfig.json` includes `.next/dev/types/**`,
and a `next dev` run from 2026-09-11 had left a route validator there naming the page. Deleting the
route made `typecheck` and `build` both fail on a module that no longer exists — in a directory
that is build output, gitignored, and a month stale. Nothing before this had ever removed a route,
so nothing had met it. `rm -rf .next/dev` is the answer; worth knowing before it wastes somebody's
afternoon.

**Nothing in the deployment needed changing, and that was checked rather than assumed.** `FAQ_URI`
is unset for the `web-next` service — empty inside the running container — so the page had been on
the built-in default the whole time. The compose repo does set it, but in
`services/web-app/env.json.template`: the **legacy** frontend's config, for the app still running on
a port of its own as a reference. It keeps its FAQ.

**What `/faq` answers now**, checked rather than left to chance: an anonymous visitor is sent to
`/login?from=/cs/faq` and a signed-in one gets the not-found page. That is `proxy.ts`'s behaviour
for _any_ path outside `PUBLIC_PATHNAMES`, not something this removal invented, and it is left
alone deliberately — keeping the path public purely so it can 404 would mean listing a route that
does not exist. `next.config.ts` has no legacy rule pointing at `/faq`, so nothing else breaks.

**X-005 carries the operator's actual instruction forward.** Our own FAQ, in both languages, in
this repo the way the guides are — and its first answer is the one he asked for: a specific problem
goes to the teacher at KI PřF UP. Worth writing once his testing has produced real questions, since
an invented FAQ answers nobody.

---

### 2026-09-12 — the operator's first hour of testing, and a clean instance

**Tickets:** PF-022, PF-023, PF-024. **Status:** done. Static checks green; the e2e suite is
**unavailable by design** — see the wipe below.

Three reports, and they turned out to be one shape: **a signed-in reader could get stuck with no
control that changes anything.**

A refusal (`forbidden()`) renders outside the app shell, so no navigation and no sign-out; its one
link goes to the public front page, which reads no session (DEC-116) and offers nothing either; and
`proxy.ts` redirects a signed-in visitor from `/login` to `/dashboard`, so when the dashboard is
what was refused, signing in is unreachable too. Each of those three is defensible alone. Together
they are a trap, and the operator fell into it within the hour.

**What his report was not** is also worth recording, because I spent time on it: I could not
reproduce the refusal itself. A narrowed effective role does not forbid the dashboard (tried
`student` and `supervisor`), no group had an exam period set, and `admin@admin.com` — the only
non-seed account — passed every screen through the API. The cause lived in his browser's session
and the evidence went with the wipe. The trap is fixed regardless; the refusal that triggered it is
not explained.

**Signing out existed only on the account screen**, which is DEC-115's decision showing its cost:
no header means nowhere obvious to put it. There is a right-aligned strip at the top of the shell
now with the reader's name and the control.

**And the deployment was wiped to nothing, at the operator's request**, to test an installation the
way a new one would arrive: `mysql_data` and `api_storage` removed, `docker compose up -d`, and the
first boot did the rest — migrations, `db:fill init`, **all seven runtime packages including
`data-linux`**, and naming the instance from `.env`. That last part is the morning's work paying
off: `data-linux` is in the API image, so a fresh install has it without a hand import.

One instance, one account, no groups, no exercises. **The e2e suite cannot run against this** —
every spec reads the `[seed]` fixtures — so verification is by hand until somebody runs `pnpm seed`,
which would defeat the point of the exercise.

**SMTP is configured and proven.** Office 365, authenticated as a real mailbox. The first attempt
was refused with `554 5.2.252 SendAsDenied` — Exchange will not let that mailbox send as
`noreply@…` without explicit rights — so `MAIL_FROM` is the authenticated address for now. Proven
by driving SMTP directly from the API container: `STARTTLS`, `AUTH LOGIN`, `250 2.0.0 OK`.

**The configuration screen is three tabs.** The operator's verdict on four forms in one column was
"nepřehledné", and he named the split himself: Jazyky, Testy, Pokročilé nastavení. The scoring
stayed with the tests rather than moving to the third tab, because the choice it belongs to is half
in the tests form (the weights) and half in the score editor — a tab boundary through the middle of
one decision. Pokročilé nastavení holds a configuration of the exercise's own: the switch into one,
or the editor for one once it has it, so a teacher who switches does not land on a tab with nothing
of theirs on it. The reasons an exercise is broken now link to the tab that answers each, because a
link that lands on the wrong tab is barely better than no link.

**The same sentence in two catalogues drifted apart, and the operator reported it twice.** The
configuration screen had a `broken.title` of its own saying what `Exercise.broken.title` said; one
got fixed and the other did not. The duplicate is gone and both screens now render the shared
banner from the shared strings.

Text, all his: _Limity spuštění_ → **Omezení zdrojů**, a limit that is exceeded now _skončí chybou_
rather than "ten test neprojde", and the validation reasons name their subject (_Úloha nemá
vytvořené žádné testy_) instead of starting with a bare "Nemá".

**Five e2e specs were rewritten for the tab split and none of them has been run.** They drive the
configuration screen section by section, and each section is now behind a `?tab=`. The suite still
cannot run against this deployment — it reads the `[seed]` fixtures, which the clean install
removed. The tabs themselves were verified by hand against the running stack: each `?tab=` renders
its own sections and nothing else.

**A long afternoon of the operator building his first real exercise**, and the product failing him
in a dozen small ways. Most of what follows was found by him doing it, not by anyone reading code.

**Two refusals that came from core-api and had to be fixed there.** A data-only exercise could not
be assigned, because assigning demands a reference solution -- a demand that makes no sense for one
that runs none of the student's code, and which nothing on the screen warns about, since it is not
part of what makes an exercise "broken". The fork now exempts it (`Exercise::isDataOnly`), measured
both ways: data-only assigns, an ordinary exercise without a reference solution is still refused
with core-api's own words. And notification e-mails are deferred by a minute and coalesced, so a
teacher who mistypes a number and fixes it writes to the student once -- `AsyncJob` already had
scheduling, upstream already defers one notification this way, and the new handler follows it.
Measured: the worker stamps `startedAt` when it _allocates_ a job, seconds before it runs one,
which is why the coalescing rule is "do not schedule a second", not "cancel the first".

**Whose screen is it.** The exercise's own page stopped carrying the two editors -- tests and limits
are what "settings" _is_, and the row above the exercise was five buttons deep. Both editors now
hang off the settings screen and lead back to it.

**The configuration screen, which he met first and understood last.** Its four-column grid
overlapped itself (a `<fieldset>` will not shrink below its content, so the columns spilled onto
each other rather than wrapping); it is two columns of bordered panels now. The expected output is
marked as an error at the field, in the test's own summary, and in the "no files attached" panel --
which is red rather than grey when it blocks, and carries a button to the files screen. **Whether
an expected output is required at all is read off the instance's pipelines**, not assumed: the
Python ones declare `expected-output`, the data-only one does not, which is exactly why a data-only
exercise saved happily with every field empty and a Python one did not.

**Three ways of scoring an exercise are one choice now**, custom expression included, and the
expression editor appears under the option that selects it. That turned up two more: the tests
became a read-only list the moment an expression was in force (so no test could be added without
first abandoning the expression), and saving tests always rewrote the score configuration, which
would have silently replaced the expression with an average. Saving tests can now say "leave the
scoring alone". Removing every test was refused with "two tests cannot share a name" -- our own
minimum, and the wrong message for it; core-api accepts an empty list, measured.

**Help, where the screen is hardest.** A `Nápověda` button on the test configuration, the limits and
the reference solutions opens a document written for a teacher who has never set one up: what each
field is for, worked examples, and what each built-in judge actually compares -- read out of the
worker's own judges (`--shuffled-tokens` is tokens on a line, `--shuffled-lines` is the lines), not
guessed from their names. Markdown in the repository, rendered on the server, same as the guides.

**And a fourth status tone.** The app had green, amber and red but nothing for "worth knowing", so
the tip that points a non-programming teacher at Data-Only had no colour to be. `info` is the
university's own blue, the one the e-mails wear.

**The afternoon the operator submitted something.** Three rounds of him testing a non-programming
exercise end to end, and each round found something the round before had hidden.

**No submission could be evaluated at all.** The worker fetches a solution from the address core-api
puts in the job, and that address was the public one -- `http://localhost/api/...` on this
deployment. In a container `localhost` is that container, so the download failed and every job died
after two reassignments. The stack had always relied on `proxy` answering to `APP_DOMAIN` over the
internal network, which works for `recodex.local` and cannot work for `localhost`. There is now a
separate internal address (`api.workerAddress` in the fork, `API_INTERNAL_ADDRESS` in the
deployment); it defaults to the public one, so a real domain is unaffected. Measured both sides:
before, "Couldn't connect to server"; after, the archive downloads and the job completes.

**Then data-only worked, and that was worse.** The judge such an exercise is given scored 1.0, and
core-api turns a score into points -- so a student who uploaded any file was handed full marks
before a teacher had seen it. The judge scores nought now, deliberately, and the screens say
"waiting to be marked" until somebody awards points. Exercises created while the old one shipped
have it replaced when their languages are saved, recognised by content so a judge a teacher wrote
themselves is never touched.

**What "marked" means took two goes.** Accepting a solution counted as marking it, so cancelling an
award left the screen showing a verdict the teacher had just withdrawn. Only points a person set --
an override or a bonus -- count now.

**And the points said what the state denied.** A row reading "10/10" beside "waiting to be marked"
is the same lie the label was fixed to stop telling, so an unmarked solution's points are `?/10`
everywhere they appear: both solution lists, the solution screen, the group's assignment list and
the dashboard. The summary rows had it worse -- they showed "Špatně", because the pipeline's nought
looks like a wrong answer -- and now say what the solution screen says.

**Also his, in the same rounds:** the assignment screen is three tabs with counts on two of them;
the settings screen is four; a data-only exercise's configuration is one tab, since the other two
are about tests it does not have; the language picker is hidden when there is one language to pick
and names it properly when there are several; and removing somebody from a group asks first.

### 2026-09-13 — the interface wears the department's colours

**The operator's word was impersonal, and it was the right word.** Every screen was shadcn's
neutral defaults: a near-black `primary`, grey on white, and nothing anywhere that said whose
deployment this is. He pointed at inf.upol.cz -- "not a bombshell, but the logo and colours are
there" -- and that is what X-006 took from it, measured rather than eyeballed: the site's computed
styles say `#016BAB` for links, headings and the navigation bar, `#00598E` on hover, IBM Plex Sans
in three weights. The blue is now `primary`, and the same hue is `accent`, `ring` and `info`, so
the pressed state of a control, the focus ring and a tip all read as one family. The neutrals are
untouched. Everything that already read its colours through tokens -- the tabs' underline, the
badges, the sidebar's active item -- changed with them and needed no edit.

**The mark is the site's own SVG, traced to four shapes** and kept small: an `i` whose dot is
blue, a blue diagonal, an `F`. The letters take `currentColor` rather than the site's near-black,
which is what lets the same component sit on a dark ground. It heads the sidebar, with the
product's name and the department's under it, and heads every anonymous page too -- a visitor at
the sign-in form now sees what they are signing in to.

**Dark mode has a switch.** Three states -- system, light, dark -- beside the language switch in
both places, because `defaultTheme="system"` was the behaviour already and a two-state toggle
would have quietly taken it away from everybody who never touched it. The pressed state is
withheld until hydration: `next-themes` only knows the stored choice on the client, and a server
that guessed would be wrong for every reader who chose (DEC-143).

**The front page got the least and shows the most.** A blue rule beside the tagline, blue section
headings, and the four explainers as cards in two columns instead of a single column of prose.
Same copy, same landmarks, same spec.

Verified live on the dev server in both modes -- landing, sign-in, dashboard, a solution screen --
and the five checks are green, 296 unit tests among them.

### 2026-09-13 — one button

**X-006's brand hover reached one button and missed forty**, which is how this session found what
D-017 fixes. Counted rather than eyeballed: 281 hand-assembled button recipes in 120 files, 85
distinct strings, and six different spellings of the primary button alone. Every one of them was a
place a colour change had to be made by hand, and X-006 made it in one.

`components/button.tsx` is the whole of it: `buttonClasses(variant, size, extra)` for a link that
looks like a button, `<Button>` for a real one, six kinds, three sizes. The sweep that moved the
app onto it was a script -- classify each `<button>`/`<Link>`/`<a>` by the tokens that name its
variant and size, keep the layout tokens that are not part of the recipe as the third argument,
refuse anything unrecognised -- and it refused exactly one thing, a `font-mono` file switcher, and
skipped two segmented toggles that are not buttons. 210 conversions, 107 files, the same DOM
before and after. **The e2e suite is not green, and was not before this:** 276 pass, 38 fail on the
branch; the same specs run against a clean worktree of `main` at `0cca4a2` fail 37 of them, the
same 37 -- the copy and the tabs changed under the specs in the last three commits there, after the
last verified run (X-008). The one failure that was this branch's own was a spec reaching for an
"Attempt N" link anywhere in the page, which X-007's trail now offers first; it looks inside the
compare picker now. Two lines rode along because they sat inside the same hunk: the reader's name
in the session bar is now a link to their profile, and table rows hover in the accent.

The showcase gains a Buttons section, so the next drift is visible on one page.

### 2026-09-13 — the trail leads back to the course

The operator asked how the breadcrumbs were, and whether anything could be made clearer. Three
things could, and all three were visible on the first screens looked at.

**A solution's trail began with a word that went nowhere.** `/solutions/:id` was the only dynamic
leaf in the manifest without `ancestors`, so from a review queue a teacher landed on _Solutions /
Solution #3_ -- the section unlinked, because it has no page, and nothing above it -- while an
assignment already led from its course. Now the trail is the course, the assignment, the attempt,
the first two links, and both reads are ones the page makes anyway.

**The last crumb and the title disagreed** -- _Solution #3_ above _Attempt 3_. The crumb says what
the title says.

**And a trail of one crumb was the title, one line higher.** Every top-level page had it. The trail
appears once there is somewhere above to go (DEC-144); the two specs that asserted the old
unlinked words assert the links instead.

### 2026-09-13 — the tab has an icon, and the small things

What X-006 left for a second pass, done. **The tab wore the default icon**: `public/` was empty and
nothing under `app/` was named `icon`. Now `icon.svg` is the mark on a brand-blue tile, an
`apple-icon.tsx` renders the same to the PNG iOS insists on, and a `viewport` gives a phone's chrome
the page's own background. **On a phone the department's name wrapped under the product's**, fighting
the two switches for the header's one row; it hides under `sm`, where the mark alone says enough.
**Reading surfaces read at 16px** -- an assignment's text, an exercise's text, a guide -- as the
department's own pages do; tables stay at 14. The dashboard's section chips wear the outline style
the buttons wear, and table rows hover in the accent rather than in grey.

### 2026-09-14 — the polish round, an outline for the guides, and accessibility measured

**What X-006 left on the table, the operator asked for.** Fields wore a frame darker than anything
else on the brand; it is light now, and the focus ring does the work. The reader's name is a chip
with their initials rather than text floating in the corner. The heading over a single _Home_ link
is gone until the Calendar arrives. And the teacher's verdict -- seven controls in a row -- is one
card in three named rows, the undo demoted to a ghost, nothing removed or renamed.

**The guides got an outline.** The install guide is four thousand pixels of nine chapters, and the
only way through it was the scrollbar. Every heading carries an id now (`rehype-slug`, so exercise
texts can be deep-linked too), and a guide lists its chapters beside the text on a wide screen and
above it on a phone, with the previous and next guide at the foot. The outline is built from the
markdown with the same slugger `rehype-slug` uses, so the two cannot disagree on an id. The
"broken container" the operator saw in the docs was a code block that screenshotted empty; its
text and colours were in the DOM and it rendered once painted -- a capture artefact of the preview
pane, written down so it is not chased twice.

**And accessibility is measured.** axe over five screens in both colour schemes, enforced at
serious and critical (DEC-145). It found two real things on the first run: github-dark's comment
grey reading at 3.3:1 on its own block -- every `#` comment in the install guide's fences, in dark
mode -- and a calendar chip whose `opacity-70` had only ever passed because the text beneath it
was near-black. The palette pushes a token towards the opposite pole until it reads, and leaves
one that already does exactly as the theme wrote it; the opacity is gone. Ten audits, no finding.

### 2026-09-14 — the operator's testing round, and a log that was eating the disk

**A 35.7 GB `error.log`, found while sizing the production VM.** 120 million lines, every one a
Nette deprecation notice about this application's own router construction: about 87 KB written per
HTTP request, measured, over six weeks of light development. Setting `error_reporting` in `php.ini`
changes nothing — Tracy's `Debugger::enable()` calls `error_reporting(E_ALL)` itself
(`Debugger.php:211`) before a request is served. The fix is one line in core-api's `Bootstrap`,
_after_ `enableTracy()`; verified from a clean image at **0 bytes over five requests**, with
`E_WARNING`, `E_NOTICE`, `E_USER_ERROR` and exceptions all still logged.

**Comment notifications are queued.** Ten people asking something in the same minute sent ten
e-mails to everybody else. `CommentNotificationJobHandler` defers five minutes and coalesces per
discussion, the same shape as the points job. What it sends is the newest comment **and a line
saying how many others came with it** — a comment is not a state that can be re-read the way a
points total is, and nine texts silently missing would be worse than the flood. Measured live
against the running stack: coalescing returns null for the second comment, the delay is 300 s, a
private comment never enters the batch. The probe also found a real defect — `postedAt` is stored
to the second, so a burst ties and "the last one" was arbitrary; the query now breaks ties on id.

**Two summary screens called an unmarked submission wrong.** The class-progress table read the
group stats row, which carries no runtime environment, so a data-only solution nobody had graded
read as _Špatně, 0/20_ on the teacher's screen while the student's own screen said _waiting_.
The dashboard had the same fault in a subtler form: the points cell already printed `?/20` while
the badge beside it was built from four hand-picked fields with `dataOnly` dropped — one row
disagreeing with itself. Unmarked solutions are also out of the "average points" tile now; their
zero was never a score.

**The rest of the round, from the operator reading his own screens.** Only the most specific
sidebar link lights (DEC-147). The assign screen offers the catalog it picks from. Discussion:
own comments are named _Já_ and coloured, teachers carry a blue mortarboard, the private-comment
hint no longer rewrites itself on the tick, and the two sentences that name what is being
discussed vary by subject rather than saying "assignment" over a solution. The review-request
control speaks to a teacher as a teacher. Verdict buttons are coloured by direction and refuse a
no-op; awarding, saving, re-running, closing a review — everything that overwrites an evaluation
or writes to a student — confirms first, reading the numbers back rather than asking "are you
sure". Points above the maximum offer a one-click split into bonus, preserving the total typed
(`lib/status/points-overflow.ts`).

**Submitted files.** A PDF is offered, not rendered (DEC-146), and the "too many files" notice that
blamed the _count_ of two files was really the byte budget — which no longer counts files that are
never fetched. Each file folds (DEC-148), with expand/collapse over all of them.

**Not verified by eye.** Nothing in this round was seen rendered: the seeded accounts are gone from
this deployment, so there is no session to drive a browser with and no valid API token. What is
verified is the five checks, the unit tests written alongside (three new pure modules), the strings
present in the deployed image, and the core-api behaviour measured in the running container. The
e2e suite still cannot run — it reads `[seed]` fixtures a clean install removed — and **nineteen
specs have now been edited without being executed**.

### 2026-09-14 — the second half of the testing round

**A bonus was missing from two screens and folded into a third.** The group's assignment table
said "20/20" where the attempts list said "20/20 +5", and the group's own standing said "25/40" —
core-api sums a group total as `getPoints() + bonusPoints` per solution
(`GroupViewFactory::getPointsGainedByStudentForSolutions`) and offers no way to ask for the two
apart. `splitGroupPoints` subtracts them back out of the per-assignment rows, which do carry the
bonus on its own; it under-reports only where an assignment is hidden from the reader, which is
where all of it is folded in today anyway. The `+5` itself had three identical copies in three
files and was about to get two more, so it is one component now.

**Review comments in a file were invisible.** White card, grey rule, inside a white code listing —
the operator added one to a text file and could not find it again. They carry the colour the badge
beside them already implies: an issue to resolve is a warning, an ordinary remark is information.
Opaque `-surface` tokens, because a tint over a highlighted line takes its colour from whatever
token is underneath. The "review is open" notice above them is a warning box for the same reason.

**Sources: the size sits at the right in both shapes** — adding the fold chevron had put it inside
the left group — and is formatted by the same `formatBytes` the rest of the app uses rather than
by a message that printed raw bytes.

**Closing a review and re-running a solution now confirm.** Both write to the student or occupy a
worker; the review dialog says what closing actually does, including that leaving the review open
and returning later is allowed.

**Answered, not changed:** a student cannot reply to a review comment or mark an issue resolved —
`addReviewComment` starts at `supervisor-student` in `permissions.neon` and the author has no
write on a review at all. Their only channels are the solution's discussion, the note, and a new
attempt. The app also stops offering "ask for a review" once a review has _ever_ started, so after
a closed review there is no way to say "fixed, look again". Left as it is pending the operator's
decision; the fix is one condition.

### 2026-09-15 — units, the verdict, and what it is a verdict on

**A memory limit with no unit on it.** The field asked for kilobytes and said so only in its
`aria-label` — present for a screen reader and for nobody else. It carries the size beside it now,
formatted like every other size in the app, following what is typed. Time carries an "s". And the
refusal that follows a bad value names both ends of the range: the operator typed 10, which is
below the floor of 128 KiB, and was told only that something was "outside what the machine
allows".

**Two doors into assigning an exercise, one of them unlocked.** The catalog's picker has always
checked all four of core-api's conditions; the exercise's own bulk-assign screen checked
`isBroken` alone, so an exercise with no reference solution was offered the whole form and refused
afterwards in English. Exercise settings meanwhile called it "configured and ready to assign" —
true of the configuration, which is the only thing `validationErrors` covers. All three screens now
say the same thing and link to the screen that fixes it.

**The judge's diff, explained where it is the judge's diff.** `-1/+1: [16]started.. != [16]started..?`
is a diff in which `[16]` is a column, not a token index; every shape in the legend was read out of
`judges/recodex_token_judge/` rather than inferred. Shown only over a log whose notation it
describes, recognised from the text — an exercise may carry a custom judge whose output means
something else, and a key to the wrong notation is worse than none.

**A passing test beside "Špatně", which took four commits to answer properly.** The exercise weights
its only test at nought, so the weighted calculator divides by zero and scores nothing. First
reaction was to refuse the configuration; the operator named the use — let the tests run and report,
award the points by hand — and it was reverted. What was actually missing was everything the screens
were not saying:

- the badge's own tooltip claimed "no test passed" over a passing test, because the three
  score-derived states described themselves in terms of tests while being read off the score;
- the tally itself was nowhere, though core-api sends each test's status and score regardless of
  what a reader may see of the details;
- `not-scored` and `reviewed` shared the word "Vyhodnoceno" in different colours;
- and a teacher's own points were indistinguishable from the pipeline's, so awarding 10/10 on a
  solution the scoring gave nothing read as "10/10 · Špatně" — the row disagreeing with itself.

So: `overridden` is a state (DEC-149), the tally sits beside the verdict on four surfaces, and the
three automatic verdicts say "(auto)" and explain that a teacher may still change them. The class
table gets both by looking the best solution up in the assignment's own solutions; the two screens
built purely on group stats cannot, and keep the automatic verdict rather than guess.

**And the explanations are visible.** They were `title` attributes — held back a second or two,
drawn in the system's style, never shown to a keyboard. `Hint` existed for exactly that complaint
and every status badge uses it now.

### 2026-09-17 — the documentation says what the product does

The operator read all three guides against the running instance and the round that came back was a
mixture of wording and of things that were simply untrue. The wording is his; the corrections are
what checking each claim against the code turned up.

**Four of them would have misled a reader.** The student guide told people to register with an
e-mail and a password — `LOCAL_REGISTRATION_ENABLED` is `false` and the registration screen says so
itself, so it sent students at a locked door; the way in is a university account or an invitation
from a teacher. It said "hodnotí se **poslední** odevzdané řešení, nikoli nejlepší", which is
exactly backwards: `AssignmentSolutions::compareBestSolution()` prefers an accepted solution, then
the most points, then the more recent — so a student who believed the guide would not resubmit for
fear of spoiling a grade they cannot spoil. It promised that an archive may be submitted, when
core-api matches uploaded names against the exercise's own `source-files` pattern and refuses a
`.zip` where `*.py` is expected. And its verdict table was in English — `OK`, `FAILED`,
`Runtime error` — while the application says `Prošel`, `Neprošel` and has no runtime-error state at
all; the states it actually has (`Čeká na hodnocení`, `Bez bodování`, `Body od vyučujícího`) were
missing.

**The teacher's guide had three more.** A group needs a name in _one_ language, not both. A
reference solution is not required to assign an exercise — `isBroken` is computed from the
configuration and says nothing about reference solutions — so "bez něj cvičení nejde zadat" was an
invention; it is the only way to _check_ the configuration, which is worth saying plainly instead.
And the whole data-only section described the behaviour that was replaced: it told teachers to
attach a two-line shell script and reported that submissions then score full marks, where today the
environment has a judge of its own, scores nought, and waits to be marked.

**The administrator's guide listed a service that does not run** (`cleaner`), omitted one that does
(`api-worker`), and answered "the cache is not cleaned automatically" with no indication of what
that means for anyone. Measured instead: the worker's cache is content-addressed, holds 14 entries
and 68 kB, and grows with the exercise catalogue rather than with traffic; `api_storage` grows with
every submission and never shrinks; and `api_log` was already 57 MB, 53 MB of it core-api's own
`user_actions.log`, which no logging driver can reach. The guide says which is which and what to do
about each.

**Markdown grew alerts** (`lib/markdown/alerts.ts`): `> [!WARNING]` becomes a coloured box, in
guides and in exercise texts alike. Twenty lines and one rule rather than a dependency, and no label
of its own — the author writes their own lead, which is the only way a translated document says it
in its own language. An unknown marker is left visible rather than swallowed.

**Two layout faults the operator saw before I did.** The anonymous header sat in `max-w-4xl` while
the guides render through `PageShell`'s `max-w-6xl`, so the mark stood an inch inside the text it
headed; the header takes `PageShell`'s container now and the landing page keeps its narrower column
_inside_ it rather than by being narrower. And a fenced code block had no surface: github-light's
background is `#fff`, which is the page, so every command in the install guide was white on white —
present, selectable and invisible. Light mode takes the app's muted surface; dark keeps
`--shiki-dark-bg`, where DEC-145's contrast was measured.

### 2026-09-20 — a teacher opens their own course, and the menu stops naming everyone else's

**The two walls the operator hit are one asymmetry.** A group's supervisor cannot open a subgroup --
upstream withholds `addSubgroup` from everyone but an administrator -- and making teachers
administrators of a shared parent is no answer, because administrator membership inherits down the
whole subtree (`Group::getAdminIdsInternal` walks the parent chain). Supervisor membership does not
inherit. Both halves of this round rest on that.

**core-api: a _Cvičící s rozšířenými právy_ may open a subgroup where they teach.** One appended
block in `permissions.neon` -- the fork's first edit to that file, kept surgical so upstream rebases
cleanly. Verified through the DI container rather than by reasoning: with no membership both
supervisor roles are refused; with a direct supervisor membership a plain supervisor is still
refused and the empowered one is allowed; marking the group as an exam or archiving it refuses both
again. The probe also demonstrated `BasePermissionPolicy::$membershipCache` live -- asking about the
same group twice in one process returned the first answer, because the cache is keyed by group id
and not by user.

Three consequences the plan had not noticed, now written down: **the creator becomes a full
administrator of the new subgroup** (not merely "can make a folder"), `actionAddGroup` accepts
`isExam`/`isOrganizational` with **no permission check** of their own, and omitting `parentGroupId`
falls back to the instance root -- so the grant widens root-group creation to a direct supervisor of
the root. This deployment's root group has no memberships at all, but that is worth checking on any
instance before shipping.

**The sidebar is built from direct membership now** (DEC-150). `getMyGroups` returns
`teachingDirect` alongside `teaching`, and only `components/app-shell/app-shell.tsx` reads it.
Narrowing `teaching` itself was the obvious move and the wrong one: it has **eleven** consumers,
five of which ask what a person may _act on_, where the inherited answer is the correct one -- the
"teacher" badge on the group list, the assignment picker's targets, the teacher dashboard's fetch,
the deadline calendar, the profile form. A department administrator would have lost review queues
for courses they are genuinely entitled to review.

**And the settings screen says which rights are held here.** The member list was built from
`privateData.admins`, the inherited set, so an administrator inherited from a parent looked exactly
like one named on this group -- and the screen offered to change their role or remove them. Neither
could work: core-api's membership lookup skips inherited rows, so a role change would have minted a
second, direct membership shadowing the first, and a removal would have done nothing. Such a row is
read-only now and says where the role comes from.

**Not visible on this deployment, and that is expected.** The operator is a direct administrator of
all five of his groups, so `teachingDirect` equals `teaching` and no member is inherited. The
difference appears the moment a colleague is given supervisor membership on a shared parent, which
is the arrangement the round exists to make possible.

**What the operator's testing then found, in the order he found it.** The subgroup list was
`Group::getAllSubgroups()` -- the whole subtree flat, a container and the course inside it side by
side -- so it is nested now, with every branch that has children folded into a `<details>` and the
first level open (DEC-148's bargain again: the browser owns the state, find-in-page reaches inside,
nothing becomes a client component). `lib/groups/subgroup-tree.ts` holds the rule and the two
shapes worth testing: core-api filters the subtree by visibility, so a visible grandchild of an
invisible child surfaces one level up rather than vanishing, and anything caught in a cycle is
surfaced too.

**And I over-corrected the member list, twice.** Making the inherited row read-only took away
something real: giving a colleague who administers the parent a _direct_ supervisor role on one
course is exactly how that course reaches their own menu. Only removal is impossible there
(`actionRemoveMember` finds no direct row and answers "The user is not a member of the group");
setting a role _creates_ one. Then the differentiated confirmation did not fire for the case that
needed it most, because "inherits" was computed by subtraction -- in `privateData.admins`, not in
`primaryAdminsIds` -- which misses somebody who inherits _and_ was named here, since the direct row
puts them in both. It is read off the ancestors now, which the page already fetches.

**Two notes went in where the questions were actually asked**: who may open a subgroup, in the place
the button would be, and what the role does, in the role's own description. The operator gave a
colleague the _group_ role Cvičící and expected subgroups to follow -- reasonable, since the
instance role that decides it carries the same word and an absent button explained nothing.

### 2026-09-20 — the import opens to teachers, and learns to read a STAG export

**The operator asked the question that exposes the gate.** Why can a plain cvičící not import people
into a group, and how are they supposed to get students in when the students have no accounts yet?
The answer was that the bulk import (AD-009) existed and was fenced off by
`viewer.role === "superadmin"` in three places — the page, the group's Students tab and the user
directory. DEC-110's reasoning was right where it was made and did not transfer: a _user_ payload
carries no permission hints, so nothing can be asked about "may this person invite anybody"; a
_group_ payload carries them, and `canInviteStudents(Group)` takes one argument, so `inviteStudents`
has been on the wire the whole time. Two of the three gates now read it. The third — an import with
no `?group=`, scoped by nothing — stays the superadmin's.

**The probe lied to me first, and the reason is worth keeping.** Asking four roles for one group's
hints inside a single PHP process reported `false` for all four, including the one that was already
allowed. `BasePermissionPolicy::$membershipCache` is static and keyed by group id **without the user
id**, so the first identity's membership level answers for every identity after it — and the first
one I tried was `student`, which is capped at student level everywhere. One role per process gives
the real answer, and it matches `permissions.neon` exactly: `inviteStudents` from `supervisor-student`
up on `isSupervisorOrAdmin`, `addStudent` from `supervisor`. That cache was noted as a trap in the
subgroup round's plan; this is it being sprung.

**The hint alone was not enough, and the deployment said so.** `inviteStudents` comes back `true` for
an **organizational** group, while `RegistrationPresenter` refuses every invitation into one — so the
hint by itself would have offered a screen on which every row fails. Archived and organizational are
checked beside it, in the page and in the action.

**The defect underneath was worse than the gate.** For somebody who already had an account the import
wrote identifiers and returned `matched` — it never put them in the group. Green, plausible, and
wrong: run it over a second-year cohort, where nearly everybody has an account, and it reports
complete success while enrolling almost nobody. `POST /v1/groups/{id}/students/{userId}` was missing,
and it is exactly what a cvičící is allowed to call. `added` and `matched` are separate states now,
told apart by the group's own `studentIds`, read once per run.

**Verified on the running deployment rather than reasoned about.** Učitel 123 sees the link on the
course they administer and not on the organizational parent, not on a course they do not teach, and
not on the instance-wide import; a student sees neither the link nor the page. As that teacher,
`POST …/students/…` really does add an existing account — added, checked, removed again, so the
instance ended where it started. And writing a study number onto an existing account really is a 403
for them, with nothing landing in `external_login`; the row says so in Czech now instead of relaying
core-api's English.

**Reading the file was the largest piece and has no dependency.** `xlsx` is the only mainstream
reader of the legacy binary format and the maintained build is not the one on npm. `spreadsheet.ts`
decides the format from the first bytes — OLE2/BIFF8, OOXML over `DecompressionStream`, an HTML
table, delimited text — because the operator's own file is named `.xls`, is a binary workbook Excel
re-saved, and portals of this kind are known to serve HTML under the same name. The awkward part is
the shared string table, which continues into `CONTINUE` records and can be cut **in the middle of a
string**, with the remainder carrying its own flag byte; a reader that ignores that works on small
files and fails on any real cohort, so it is implemented and it is tested. Fixtures are built byte by
byte in the tests rather than committed — the real export carries a student's name, address and study
number.

**The narrowing is an inversion of the paste rule.** Pasted text turns an unknown column into an
identifier, which is right for a table somebody typed; the STAG export has thirty-six columns, `stav`
is `S` for every student, and identifiers are unique per service, so that rule would have produced
thirty collisions per row. An uploaded file keeps only what is recognised — six columns — and prints
what it dropped. Surnames arrive in capitals (`BENEŠ`) and are repaired to `Beneš`, also in view: all
of it lands in the same text box the reader already checks, so every guess can be typed over before
anything is sent.

**Not done.** The e2e spec for this is written and **has not run** — the suite still cannot, since
the clean install has no `[seed]` fixtures. `MAX_ROWS` stays at 200. A study number still cannot be
filled onto an existing account by a teacher: core-api was deliberately left untouched this round,
and the comment at `RegistrationPresenter.php:441-445` promising a screen for it remains wrong.

### 2026-09-22 — the catalogue admits which group an exercise belongs to

**The whole ticket was a field the type refused to read.** `groupsIds` has been on every
`/v1/exercises` row since forever (`ExerciseViewFactory.php:60`); `ExercisePayload` simply never
declared it, so TypeScript would not let anybody look. Declaring it, carrying it onto
`ExerciseListItem`, and resolving the names from `getGroupList` -- which is built on the same
memoized `/v1/groups` fetch the group screens already make -- is the entire Group column.

**The filter needed no work at all, which is the part worth knowing.** `filters[groupsIds][]` is
not "attached to this group": core-api expands the id through `groupsIdsAncestralClosure` before
matching, so a lab inherits whatever its course holds. The assign screen's picker has relied on
that since G-010. Measured here before trusting it: the child group returns its parent's five
exercises, an unrelated branch returns none.

**So the screen now shows two different answers at once**, and that is the one thing that needed
design rather than plumbing. Filter by a lab and rows appear whose Group column names the course
above it -- correct, and indistinguishable from a bug without a word of explanation. One sentence
appears above the table whenever a group filter is on, and only then.

**Two smaller decisions.** The option labels are the immediate parent and the name: the chain from
the instance root is _Univerzita Palackého v Olomouci / Katedra Informatiky / Výuka / KMI/ALGO1 -
Alg. 1 / ALGO1 - Úterý_, which a `<select>` truncates to nothing useful, and `group-info.tsx` had
already settled on showing one parent. The full path is on the option's `title` and on the
column's hint. And a group the reader cannot see prints as nothing rather than as a UUID, matching
what `GroupListEntry.path` does for an invisible ancestor.

**One thing the change broke and fixed.** Putting Group before Tags moved Author from the fifth
cell to the sixth, and `exercise-catalog.spec.ts` asserted `td:nth-child(5)` with a comment naming
the old column order. Corrected, with the reason written beside it -- the suite cannot run on this
deployment, so a stale index would have survived until somebody re-seeded and blamed the author
filter.

### 2026-09-25 — the group filter becomes searchable, and starts showing what sits inside what

**The complaint was that the filter is unreadable, and it was right.** X-016 shipped a `<select>`
whose options were `parent / name` and nothing else: seven strings, several of them beginning with
the same faculty, with no indication that `KMI/JP - Jazyk Python` contains `2025/26 - Jazyk Python
(36b)`. That containment is the entire decision — filtering by the course returns what the seminar
group would return and more (DEC-153) — and the control withheld it.

**Matching against the full path is what makes one query answer the question.** A search for
`KMI/JP` matches the course by its own name and the seminar group by its path, so both arrive
together; `groupRows`, the assign offer's tree flattener from T-012, then puts each match under the
containers it hangs in. The indentation is therefore the real hierarchy rather than an artefact of
which rows happened to survive the filter — which is the property the new
`lib/groups/group-search.test.ts` pins, using the operator's own tree from the screenshot.

**One latent bug in `groupRows` fell out of reusing it.** It recorded a group's path as shown but
not the group's own name, so a group that was both selectable and somebody's container was printed
twice: once as a row, once as the heading above its children. The assign offer never hit it because
a container there cannot take an assignment and is absent from the list in the first place. Fixed
where it lives, with a test naming the case.

**Punctuation is deliberately not folded.** Case and diacritics are (`utery` finds `ALGO1 - Úterý`),
but course codes are written `KMI/JP`, and stripping the slash would turn that query into a fuzzy
match on every path whose letters happen to line up.

**The screen still works without JavaScript**, which is not sentiment: every filter here is a URL and
a round trip, and a shareable narrowed view is the point of the design. The native `<select>` is what
the server renders and what a reader without scripting keeps; the combobox replaces it on the first
client render. `useSyncExternalStore` does that rather than a `setState` in an effect — React
provides it exactly for a value that differs between server and client, and
`react-hooks/set-state-in-effect` rejects the alternative outright.

**Accessibility is where the indentation had to be paid for.** A listbox may contain nothing but
options, so the heading rows are `aria-hidden` decoration and each option carries the full chain on
its own `aria-label`: the eye reads the indentation, a screen reader hears
`Výuka / KMI/JP - Jazyk Python / 2025/26 - Jazyk Python (36b)`.

**Run:** five checks green (`typecheck`, `lint`, `format:check`, `build`, `test` — 402 unit tests,
seven of them new). **Not run:** the e2e suite, which still cannot run on this deployment; the
catalogue spec's group step was rewritten from `selectOption` to the combobox anyway, so it does not
rot in place.

### 2026-09-25 — the dashboard stops showing other people's courses

**The same complaint as DEC-150, in the two places that round left alone.** The sidebar's "Moje
výuka" has followed direct membership since X-014; the dashboard's calendar and teaching section
still read `teaching`, the inherited-plus-direct set, so an administrator of a department opened
the app onto every colleague's deadlines. `getMyGroups` has returned `teachingDirect` since X-014,
so there was no API work to do — the ticket is which of two lists each call site reads.

**Three things stay wide, and each for its own reason.** `member`, because a student's deadlines
belong in their month whatever they teach. The review queues, because core-api decides whose plate
a review is on (`/v1/users/{id}/pending-reviews`) and deriving them from a group list would hide
work that was genuinely assigned. And `groupNames`, because it resolves the names those queues
print — narrowed, a review in a group the reader administers without teaching would render without
one. Whether the teaching half appears at all is likewise still the wide question.

**It is not reproducible on this deployment, and that is worth saying plainly.** The issue named
`ALGO1 - Úterý` — a real course under a parent the operator administers, belonging to somebody else
— as the thing that should disappear. It holds **zero assignments**, so it contributes no deadlines
and the dashboard renders identically before and after. Measured both ways rather than assumed: the
change was stashed, the page re-read, and the output compared character for character.

**So the behaviour is pinned by unit tests instead of by the page.** The choice moved into
`lib/groups/deadline-sources.ts`, a pure module — `lib/api/dashboard.ts` imports `server-only` and
nothing in it can be reached from a test — with five cases: an inherited course is in neither list,
a studied group survives, a group both studied in and taught appears once, containers are dropped
from both, and nobody's dashboard is not an error. The e2e seed has no inherited-but-not-taught
group to assert against; worth adding the next time the seed changes, and recorded on the ticket.

**Run:** five checks green (`typecheck`, `lint`, `format:check`, `build`, `test` — 407 unit tests,
five of them new). **Not run:** the e2e suite, which still cannot run on this deployment.

### 2026-09-25 — the exercise form stops arguing with itself

**The operator could save an exercise once.** The second save was refused with "the exercise was
edited in the meantime and the version has changed" — by his own first save, seconds earlier.

`version` is core-api's optimistic lock and it lived in the form's own schema, so it held whatever
the page was rendered with. Save one sent 4 and left the server on 5; save two sent 4 again. The
form does call `router.refresh()`, and that does bring 5 down as a prop, but React Hook Form reads
`defaultValues` at mount and the component outlives a refresh.

**It is a parameter now, read from the props on every submit** — which is what
`assignment-texts-form.tsx` and both pipeline editors have always done, and the reason they were
never reported. Every other versioned form was checked; none of them holds the lock in form state.

**Pinned by a schema test, because nothing else could catch it.** It is a component-lifecycle fault:
types, lint and the rest of the suite were all perfectly happy with the broken version. The test
asserts the schema does not carry `version` at all, which is the thing that must stay true.

**Measured on the running deployment, the operator's own way in:** three consecutive saves of a real
exercise, no refusal, no error banner, three `200`s with a refresh between each. Saving unchanged
values is safe to do to somebody else's data, which is why it could be tested at all —
`Localizations::updateCollection` replaces a localized entity only when it actually differs, so the
assignments made from that exercise were not marked as drifted by the test.

**Left alone, deliberately:** the refusal arrives in English, because `failure()` passes core-api's
message through verbatim (DEC-092). After this it is only reachable when a colleague really did save
first. Translating server-action errors by code is its own round, and its own ticket when asked for.
