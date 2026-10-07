import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { instanceName } from "./helpers/core-api";
import type { SeedAccount } from "./helpers/accounts";

async function signIn(page: Page, account: SeedAccount, path = "/en/groups"): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test.describe("the group list", () => {
  test("shows the reader's own groups and how they relate to them", async ({ page }) => {
    await signIn(page, STUDENT);

    const row = page.getByRole("row", { name: /Intro to Programming/ }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Student")).toBeVisible();
  });

  test("filters without a round trip and keeps the filter in the URL", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    // **Scoped to `main`, and PF-010 records why the unscoped form was a strict-mode violation.**
    // The row that filed it guessed the app renders this control twice for its responsive layouts;
    // it does not -- `data-table.tsx` renders one input, and the second match is React's own. Since
    // PF-002 the page streams, so a Suspense boundary's content is delivered into a staging `div`
    // at the end of `<body>` and relocated into place by an inline script: while that is in flight
    // the document genuinely holds two copies of everything inside the boundary, one in
    // `main#main-content` and one in `div#S:2`. An unscoped `page.getBy*` matches both, which is
    // why this failed on some instances and not others -- it is a race, not a layout.
    const main = page.getByRole("main");
    const rowsBefore = await main.getByRole("row").count();
    await main.getByPlaceholder("Filter groups").fill("Large Lecture");
    await expect(page).toHaveURL(/groups-q=Large\+Lecture/);
    await expect(main.getByRole("row")).not.toHaveCount(rowsBefore);
    await expect(main.getByRole("row", { name: /Large Lecture/ })).toBeVisible();
  });

  test("marks what kind of group a row is", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    // The instance root is the one public group on this instance. (No seeded group is
    // organizational, so that badge has no data behind it here -- see F-029.)
    const row = page.getByRole("row", { name: await instanceName() }).first();
    await expect(row.getByText("Public")).toBeVisible();
  });

  test("opens a group", async ({ page }) => {
    await signIn(page, STUDENT);

    await page
      .getByRole("main")
      .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  });

  test("excludes archived groups but links to where they are", async ({ page }) => {
    await signIn(page, SUPERADMIN);

    await expect(page.getByRole("row", { name: /Retired Course/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived groups" }).click();
    await expect(page).toHaveURL(/\/en\/archive$/);
  });
});

test.describe("the archive", () => {
  test("lists archived groups and nothing else", async ({ page }) => {
    await signIn(page, SUPERADMIN, "/en/archive");

    await expect(page.getByRole("row", { name: /Retired Course/ })).toBeVisible();
    await expect(page.getByRole("main").getByRole("row", { name: /Large Lecture/ })).toHaveCount(0);
  });

  test("links back to the active groups", async ({ page }) => {
    await signIn(page, SUPERADMIN, "/en/archive");

    await page.getByRole("link", { name: "Active groups" }).click();
    await expect(page).toHaveURL(/\/en\/groups$/);
  });
});

test.describe("the group detail", () => {
  test("shows what the group is, who runs it and what it contains", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "[seed] Intro to Programming" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Details" })).toBeVisible();
    // Sam and the superadmin administer this group; both come from one batched user lookup.
    await expect(main.getByRole("link", { name: "Sam Supervisor" })).toBeVisible();
    // A student sees where they stand.
    await expect(main.getByRole("heading", { name: "My standing" })).toBeVisible();
  });

  test("links up to the parent group and down to the subgroup", async ({ page }) => {
    await signIn(page, SUPERADMIN);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "Subgroups" })).toBeVisible();
    await main.getByRole("link", { name: /Lab A/ }).click();
    await expect(main.getByRole("heading", { name: /Lab A/ })).toBeVisible();

    // ...and back up, through the parent row.
    await main.getByRole("link", { name: "[seed] Intro to Programming", exact: true }).click();
    await expect(main.getByRole("heading", { name: "[seed] Intro to Programming" })).toBeVisible();
  });

  test("falls back to the info tab for an unknown tab rather than failing", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);

    await page.goto(`${new URL(page.url()).pathname}?tab=nonsense`);
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Description" }),
    ).toBeVisible();
  });
});

test.describe("the group's assignments tab", () => {
  test("lists the assignments with the reader's own result", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
    await page.getByRole("link", { name: "Assignments", exact: true }).click();

    const main = page.getByRole("main");
    await expect(main.getByRole("columnheader", { name: "My status" })).toBeVisible();
    await expect(main.getByRole("row")).not.toHaveCount(1);
  });

  test("filters server-side, in the URL", async ({ page }) => {
    await signIn(page, STUDENT);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
    await page.getByRole("link", { name: "Assignments", exact: true }).click();

    const rows = page.getByRole("main").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const rowsAll = await rows.count();

    await page.getByRole("link", { name: "Closed", exact: true }).click();
    await expect(page).toHaveURL(/filter=closed/);
    expect(rowsAll).toBeGreaterThan(0);

    // What "closed" contains depends on the date, not on this app: the seed sets real deadlines and
    // they pass as the calendar moves. This used to assert the empty state, which was true the week
    // the seed was written and became false the week a deadline expired. So assert the property that
    // is actually about the filter -- it narrows, and its result round-trips through the URL --
    // rather than a count that time decides.
    const closedRows = await rows.count();
    expect(closedRows).toBeLessThanOrEqual(rowsAll);
    if (closedRows === 0) {
      await expect(page.getByText("No assignment has passed its deadline.")).toBeVisible();
    }
    await page.reload();
    await expect(rows).toHaveCount(closedRows);
  });

  test("does not offer a supervisor a filter for their own submissions", async ({ page }) => {
    await signIn(page, SUPERADMIN);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
    await page.getByRole("link", { name: "Assignments", exact: true }).click();

    await expect(page.getByRole("link", { name: "With my submissions" })).toHaveCount(0);
    // ...and no columns about a solution they never submitted.
    await expect(page.getByRole("columnheader", { name: "My status" })).toHaveCount(0);
  });
});

test.describe("the group's students tab", () => {
  test("shows the roster with points to someone who may see it", async ({ page }) => {
    await signIn(page, SUPERADMIN);
    await page
      .getByRole("main")
      .getByRole("link", { name: /Intro to Programming$/ })
      .click();
    await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
    await page.getByRole("link", { name: "Students", exact: true }).click();

    // Scoped to the roster: T-006 put a second table on this tab, and every student appears in
    // both.
    const roster = page.getByRole("main").getByRole("table").first();
    await expect(roster.getByRole("link", { name: "Alice Student" })).toBeVisible();
    await expect(roster.getByRole("columnheader", { name: "Points" })).toBeVisible();
  });
});

/**
 * The points matrix on the Students tab (T-006): every student against every assignment, which
 * S-007's roster deliberately left out.
 *
 * Read-only, so it leaves nothing behind. What it asserts is the distinction the matrix exists to
 * make -- a cell that was never submitted reads differently from one where every attempt failed,
 * which is the complaint Q-012 records about the dashboard and the reason the extra
 * `/v1/assignment-solvers` call is worth making.
 */
test("shows points per student and per assignment, and says which cells were never attempted", async ({
  page,
}) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=students`);

  const section = page.getByRole("region", { name: "Points, assignment by assignment" });
  await expect(section).toBeVisible();

  // A column per assignment and per shadow assignment (X-032), plus the student and total
  // columns, and a row per student. The filter narrows it to one kind.
  const matrix = section.getByRole("table");
  await expect(matrix.locator("thead th")).toHaveCount(7);
  await section.getByRole("link", { name: "Shadow only" }).click();
  await expect(matrix.locator("thead th")).toHaveCount(4);
  await section.getByRole("link", { name: "Standard only" }).click();
  await expect(matrix.locator("thead th")).toHaveCount(5);
  const alice = matrix.getByRole("row").filter({ hasText: "Alice Student" });
  await expect(alice).toHaveCount(1);

  // Every column header links to its assignment, and the row header to the person.
  await expect(matrix.getByRole("link", { name: /Echo Greeting/ }).first()).toBeVisible();
  await expect(alice.getByRole("link", { name: "Alice Student" })).toBeVisible();

  // The distinction the table exists for: a cell nobody attempted is not a cell worth nothing.
  // **This assertion used to be the other way round** -- while no evaluation could succeed, every
  // attempted cell was the "everything failed" `!` and the pair being told apart was `!` against
  // `—`. Since PF-016 an attempt carries real points, so the pair is a score against `—`, and the
  // failure glyph is the one with no fixture left (PF-017).
  //
  // The `—` is read from the decorative span rather than the cell: P-002 moved the explanation out
  // of a `title` attribute and into visually hidden text beside the glyph, and sr-only text is
  // clipped, not hidden, so it is part of the cell's innerText.
  const marks = await matrix.locator('tbody td span[aria-hidden="true"]').allTextContents();
  expect(marks.some((mark) => mark.trim() === "—")).toBe(true);
  await expect(matrix.getByText("Nothing submitted").first()).toBeAttached();

  // ...and at least one cell that *was* attempted shows what it scored.
  await expect(alice.getByText(/^\d+\s*\/\s*\d+$/).first()).toBeVisible();
});
