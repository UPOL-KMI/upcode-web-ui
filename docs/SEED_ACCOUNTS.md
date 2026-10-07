# ReCodEx New Frontend — Seed Test Accounts

**Status:** Implemented (F-025), verified idempotent against a live instance -- genuinely so since
the 2026-08-21 review pass, which found four bugs that only appeared on a _fresh_ database or
after a failed partial run (hardcoded pipeline id, half-created exercise reuse, non-idempotent
test creation, hardcoded exercise version). See `docs/PROGRESS.md`.
**Date:** 2026-08-17

This replaces the recon-phase plan that used to live here (Group A/B/C names, `seed-student1`
style credentials) — those never matched what `scripts/seed.ts` actually builds. See
`docs/DECISIONS.md` and `docs/PROGRESS.md`'s F-025 entry for the API recipe and the bugs found
along the way.

---

## Accounts

All passwords are the single fixed value below — not a secret, throwaway test data on a
disposable instance (brief §1).

**Password for every seeded account (except the superadmin): `RecodexSeed123!`**

| Email                                                                     | Global Role          | Group Memberships                                                                     | Purpose                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin@admin.com`                                                         | `superadmin`         | —                                                                                     | **Not created by this script** — the deployment's own first-boot seed. Password `admin`. Reused as-is per the brief.                                                                   |
| `alice.student@seed.recodex.local`                                        | `student`            | Student of **Intro to Programming**                                                   | Plain student, mixed submission states                                                                                                                                                 |
| `bob.classmate@seed.recodex.local`                                        | `student`            | Student of **Intro to Programming**                                                   | The second student in the primary group: the other side of the similarity fixture, the drill-down's "across two assignments", and the one a per-author flag may be written on (PF-013) |
| `seed.newcomer@seed.recodex.local`                                        | `student`            | —                                                                                     | Belongs to no group: the account an invitation is accepted with (G-026)                                                                                                                |
| `sam.supervisor@seed.recodex.local`                                       | `supervisor`         | Admin of **Intro to Programming**, plain supervisor (non-admin) of **Retired Course** | Admin of one group, plain member of another                                                                                                                                            |
| `sasha.mentor@seed.recodex.local`                                         | `supervisor-student` | Admin of **Large Lecture**, plain student of **Intro to Programming / Lab A**         | The brief's §2 "one person, two audiences" case                                                                                                                                        |
| `seed.filler.01@seed.recodex.local` … `seed.filler.25@seed.recodex.local` | `student`            | Students of **Large Lecture**                                                         | Pagination filler — 25 accounts                                                                                                                                                        |

Override the admin credentials the script logs in as via `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` env vars if you ever change them on the deployment.

---

## Groups

| Name                                  | Parent               | Archived | Purpose                                                                                                                                |
| ------------------------------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `[seed] Intro to Programming`         | —                    | No       | Primary group; has a subgroup                                                                                                          |
| `[seed] Intro to Programming / Lab A` | Intro to Programming | No       | Satisfies "one group has a subgroup"                                                                                                   |
| `[seed] Retired Course`               | —                    | **Yes**  | Satisfies "one archived group". Archived _after_ adding sam.supervisor as a member — see the `group.isNotArchived` gotcha below        |
| `[seed] Large Lecture`                | —                    | No       | Pagination stress: 25 students, 25 assignments                                                                                         |
| `[seed] Faculty of Seeded Studies`    | —                    | No       | **Organizational** — holds groups, can hold no assignments. core-api refuses the flag once a group has students or assignments (F-029) |

---

## Exercises

One **working** exercise, `[seed] Echo Greeting` (python3, stdin→stdout diff against a fixed
expected output), reused across every assignment below instead of building a new exercise per
assignment — see `docs/DECISIONS.md` for the full API recipe and why. It has one reference
solution (required before an exercise can be assigned to any group at all).

Plus **24 catalog fixtures** (T-020), created with core-api's defaults and left that way: six named
ones (`[seed] Binary Search`, `Merge Sort`, `Graph Colouring`, `String Reversal`,
`Matrix Multiplication`, and `Retired Puzzle`, which is **archived**) and eighteen
`[seed] Catalog Filler NN`. Being unconfigured, every one of them is `isBroken`, has no reference
solution and cannot be assigned — which is a real state the catalog has to render, and the state a
half-written exercise is in. Tags (`seed-algorithms`, `seed-graphs`) and difficulties vary so that
each filter on the catalog screen has something to filter by, and the total is past one page.

**A gotcha this uncovered:** `GET /exercises` **excludes archived exercises by default**, so a
lookup by name must pass `filters[archived]=all` or it cannot see one — `findExerciseByName` does,
and without it the archived fixture was re-created on every run.

---

## Assignments

| Group                | Count | Notes                                                                                                                                                                                                                                 |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro to Programming | 3     | One with `alice.student`'s submissions (below), one left untouched — the brief's "at least one assignment with nothing submitted yet" — and one with a **second deadline** (10 points before, 5 after), the only one anywhere (F-029) |
| Large Lecture        | 25    | Pagination filler, staggered deadlines, no submissions                                                                                                                                                                                |

## Submissions

| Student       | Assignment                                | Note (idempotency key) | Content                                                                                                                                                                                                |
| ------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| alice.student | Intro to Programming's primary assignment | `[seed] correct`       | Prints the exact expected greeting                                                                                                                                                                     |
| alice.student | same                                      | `[seed] wrong`         | Prints something else, deliberately incorrect                                                                                                                                                          |
| alice.student | same                                      | `[seed] zip archive`   | A real ZIP holding `main.py` + `greeting.py` — the only submission that is an **archive**, and the only input that makes core-api report `zipEntries` (S-017 expands them into `solution.zip#main.py`) |

## Review states (S-002 fixtures)

| Solution                           | State                           | Set by              | Why                                                             |
| ---------------------------------- | ------------------------------- | ------------------- | --------------------------------------------------------------- |
| `alice.student` / `[seed] correct` | `reviewRequest` flag set        | the student herself | Feeds the teacher dashboard's "reviews students have asked for" |
| `alice.student` / `[seed] wrong`   | review **opened and left open** | `admin@admin.com`   | Feeds the teacher dashboard's "reviews you have open"           |

Neither state can be produced by submitting alone, and without them the teacher half of the
dashboard has nothing to render. Both are idempotent: the script reads the solution's current
`reviewRequest` / `review` fields and does nothing if it is already in the wanted state. A review
counts as _pending_ precisely when `review.startedAt` is set and `review.closedAt` is `null`, so
closing it while testing (S-018) removes the row -- re-run `pnpm seed` to get it back, which
re-opens the closed review.

---

**These do not currently reach genuine pass/fail on this dev machine.** This Mac's Docker
Desktop runs cgroup v2 only; the vendored `isolate` 1.8.1 sandbox requires cgroup v1 (see
the compose repo's `README.md`, "Before going to production, read this: `worker` needs cgroup v1" — a
pre-existing, already-documented limitation, not something introduced by this script). Every
submission resolves to an infrastructure `evaluation_failure` (`Isolate init error`) instead of a
real judged result. Re-verify the actual pass/fail split on a cgroup v1 host — production, or a
locally fixed Docker config — before relying on this for evaluation-state UI work.

---

## Running it

```bash
pnpm seed
```

Reads `API_BASE_INTERNAL` (falling back to `API_BASE_PUBLIC`) from `.env.local` via
`tsx --env-file=.env.local`. Safe to re-run any number of times — every entity is looked up by a
fixed `[seed]` name/note before creating, so re-running does not duplicate anything. Verified: a
clean re-run against fully-seeded state produces zero creates (all `exists, reused` / `already
exists, skipping submit`).

**Two exercise-configuration bugs were found and fixed in S-014**, both invisible until something
went through the _real_ submit path: the exercise's environment config declared no `source-files`
variable, so `POST /pre-submit` could not match an uploaded `solution.py` to any runtime
environment and offered none at all (the seed's own submissions never noticed, because they pass
`runtimeEnvironmentId` directly); and assignments are _snapshots_ of their exercise, so fixing the
exercise left every assignment already created from it on the old copy. The script now declares
`source-files: ["*.py"]` and re-syncs every seeded assignment whose
`exerciseSynchronizationInfo` reports it stale. That re-sync runs on **every** seed, not only the
first, because `getOrCreateBaseExercise` deliberately rewrites the exercise's configuration each
time -- which by definition leaves the assignments one version behind.

**One exception was found and fixed in F-029:** the exercise's _reference solution_ was submitted
unconditionally, because every other write in `getOrCreateBaseExercise` replaces and that one
appends. Eight had accumulated on this instance before anyone looked. It is now guarded by its
`[seed] reference solution` note, like every other append in the script. The pre-existing extras
are harmless and were left alone — deleting instance data is an operator's call, not this
script's.

---

## Grading demo (`pnpm seed:grading-demo`, X-032)

A separate, idempotent script for an instance that holds real courses (DEC-167): one group,
**`[demo] Hodnocení a stínové úlohy`**, percentage threshold 50 %, and four students, all with the
password above. `SEED_DEMO_SUPERVISOR_EMAIL=<your address>` makes that account a supervisor of the
group, and picks its instance; `SEED_INSTANCE_ID` overrides the instance. Solutions are really
evaluated, so broker and worker must be running.

What is in it:

- Assignments, all from `[seed] Echo Greeting`: **Bonus 1, 2, 3** (5 points each, bonus, public),
  **Skrytá úloha** (10, not public), **Viditelná až za týden** (10, `visibleFrom` in a week).
- Shadow assignments **Stínová 01–10**, 10 points each; only **01** is public.
- A supervisor, **`teacher.demo@demo.recodex.local`**, for the teacher's side under a known password.

| Student                         | Did                                                                                       | Body  | Odevzdáno | Hodnoceno | Hranice     |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ----- | --------- | --------- | ----------- |
| `adam.demo@demo.recodex.local`  | Bonus 1 correct, points set to 2 · Bonus 2 correct, review closed · Bonus 3 wrong · 01: 5 | 12/10 | 3/3       | 3/4       | Splňuje     |
| `bara.demo@demo.recodex.local`  | nothing                                                                                   | 0/10  | 0/3       | 0/4       | Pod hranicí |
| `cyril.demo@demo.recodex.local` | Bonus 1 wrong · hidden 02: 10                                                             | 0/10  | 1/3       | 0/4       | Pod hranicí |
| `dana.demo@demo.recodex.local`  | Bonus 1 points set to 5 · Bonus 2 review closed · Bonus 3 bonus +1 · 01: 10               | 26/10 | 3/3       | 4/4       | Splňuje     |

Before X-032 a teacher read Adam as **12/120** and Cyril as **10/120** (hidden work in the maximum,
Cyril's hidden shadow points in the sum). In the matrix, Cyril's 10 sits in the dimmed
"Stínová 02" column and in no total. "Pouze standardní" shows totals out of 0 for everyone: every
visible standard assignment here is a bonus.

---

## A real gotcha worth remembering

`POST /v1/groups/{id}/members/{userId}` (and `/students/{userId}`) checks `group.isNotArchived`
against the **group**, but ALSO checks `becomeMember`/similar against the **target user's own
role's ACL** — and that check also requires `group.isNotArchived`. Concretely: **you cannot add
any member to an already-archived group**, even as superadmin. `scripts/seed.ts` archives
`[seed] Retired Course` as the _last_ step for that group, after `sam.supervisor` is already a
member — do not reorder this if you touch the script.

---

## Resetting

Wiping the database is an **operator-level** action outside this script's reach — `docker compose
down -v && up -d` in the compose repo, not something `scripts/seed.ts` does or assumes. After a wipe,
just run `pnpm seed` again; it starts from "just the seeded superadmin" and rebuilds everything.

**Never** attempt SQL or direct database manipulation — every operation in `scripts/seed.ts` goes
through the public API, by design (brief §1).
