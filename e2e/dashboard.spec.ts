import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN, SUPERVISOR_STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SeedAccount } from "./helpers/accounts";

/**
 * The dashboard's student section (S-001).
 *
 * Every assertion here is about *which* rows appear and in what order, never about a specific
 * date or point total: the seed script sets deadlines relative to when it ran, so anything
 * hardcoded would rot the day someone re-seeds. Deadline ordering is checked by reading the
 * machine-readable `datetime` attributes the `DateTime` component emits and asserting they
 * ascend -- which is the actual product requirement (IA §4.1: "sorted by urgency"), stated
 * without depending on what the dates are.
 */
/** The deadline table specifically -- S-025 added a second table to the same student section. */
function upcoming(page: Page) {
  return page.getByRole("region", { name: "Upcoming deadlines" }).getByRole("table");
}

async function signIn(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto("/en/dashboard");
}

test.describe("as a student", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, STUDENT);
  });

  test("lists open assignments with their group, deadline and status", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();

    const rows = upcoming(page).locator("tbody tr");
    await expect(rows).not.toHaveCount(0);

    const firstRow = rows.first();
    await expect(firstRow.getByRole("link", { name: /Echo Greeting/ })).toBeVisible();
    await expect(firstRow.getByRole("link", { name: /Intro to Programming/ })).toBeVisible();
    await expect(
      firstRow.getByText(/Not submitted|Correct|Partly correct|Evaluating/),
    ).toBeVisible();
  });

  test("orders the deadlines by urgency, nearest first", async ({ page }) => {
    // `evaluateAll` does not auto-wait, so the section has to be there before it runs -- this
    // section is streamed behind a `Suspense` boundary, and reading it early yields an empty list
    // and an assertion that passes or fails on timing rather than on order.
    await expect(upcoming(page).locator("tbody tr").first()).toBeVisible();

    const timestamps = await upcoming(page)
      .locator("tbody tr td:nth-child(3) time:first-child")
      .evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute("datetime") ?? "")));

    expect(timestamps.length).toBeGreaterThan(0);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    // Nothing already past its deadline belongs in this panel.
    expect(Math.min(...timestamps)).toBeGreaterThan(Date.now());
  });

  test("summarises points per group and links to the group", async ({ page }) => {
    const progress = page.getByRole("heading", { name: "My progress" });
    await expect(progress).toBeVisible();

    const bar = page.getByRole("progressbar").first();
    await expect(bar).toBeVisible();
    const gained = Number(await bar.getAttribute("aria-valuenow"));
    const max = Number(await bar.getAttribute("aria-valuemax"));
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(max).toBeGreaterThan(0);
    expect(gained).toBeLessThanOrEqual(max);
  });

  test("lists work that is graded without anything being submitted", async ({ page }) => {
    // S-025. A table of its own, never rows in the deadline table above: every column there is
    // about a submission, and a shadow assignment has none (DEC-079).
    const shadow = page.getByRole("region", { name: "Graded without a submission" });
    await expect(shadow.getByText("the deadline is informative")).toBeVisible();

    const awarded = shadow.getByRole("row").filter({ hasText: "[seed] Oral Exam" });
    await expect(awarded.getByRole("cell", { name: "8/10" })).toBeVisible();
    await expect(
      awarded.getByRole("cell", { name: "[seed] oral exam", exact: true }),
    ).toBeVisible();

    // Nothing awarded yet sorts first: it is the row the reader might still act on.
    const rows = shadow.locator("tbody tr");
    await expect(rows.first()).toContainText("[seed] Term Presentation");
    await expect(rows.first()).toContainText("— / 20");

    // The deadline is stated without any of the urgency the real ones carry.
    await expect(shadow.getByText(/Open|Second deadline|Closed/)).toHaveCount(0);
  });

  test("opens the shadow assignment behind one of those rows", async ({ page }) => {
    await page
      .getByRole("region", { name: "Graded without a submission" })
      .getByRole("link", { name: "[seed] Oral Exam" })
      .click();

    await expect(page).toHaveURL(/\/en\/shadow-assignments\/[0-9a-f-]+$/);
  });

  test("opens the assignment behind a deadline row", async ({ page }) => {
    await upcoming(page).locator("tbody tr").first().getByRole("link").first().click();

    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
    // The trail is the course the assignment was set in, then the assignment itself -- never the
    // "Assignments" section, which has no page of its own.
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("Assignments")).toHaveCount(0);
    await expect(breadcrumb.getByRole("link")).toHaveCount(1);
    await expect(breadcrumb.getByRole("link")).toHaveAttribute("href", /\/en\/groups\/[0-9a-f-]+$/);
  });
});

test("shows only the sections the viewer's memberships call for", async ({ page }) => {
  // The superadmin administers the seeded groups but studies in none of them, so the teaching
  // half appears and the student half does not -- IA §4.1's rule that the sections follow
  // per-group membership rather than the global role.
  await signIn(page, SUPERADMIN);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "My teaching" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Upcoming deadlines" })).toHaveCount(0);
});

test.describe("as a teacher", () => {
  test.beforeEach(async ({ page }) => {
    // The superadmin administers every seeded group, which is where the seeded open review and
    // review request live (`scripts/seed.ts`).
    await signIn(page, SUPERADMIN);
  });

  test("queues the reviews waiting on the teacher, oldest first", async ({ page }) => {
    for (const heading of ["Reviews you have open", "Reviews students have asked for"]) {
      const queue = page.getByRole("region", { name: heading });
      await expect(queue).toBeVisible();

      // Alice's row is *in* the queue, not necessarily at the top of it: the queue is ordered
      // oldest-first across every group this teacher administers, and on a deployment where
      // somebody has an older open review of their own the seeded row is not first. Which row
      // leads is a fact about the deployment; that the seeded one is queued, and that the order is
      // oldest-first, are facts about the app -- and both are still asserted (PF-013).
      const rows = queue.locator("tbody tr");
      await expect(rows.getByRole("link", { name: "Alice Student" }).first()).toBeVisible();

      const waiting = await queue
        .locator("tbody tr td:nth-child(4) time:first-child")
        .evaluateAll((nodes) =>
          nodes.map((node) => Date.parse(node.getAttribute("datetime") ?? "")),
        );
      expect(waiting.length).toBeGreaterThan(0);
      expect(waiting).toEqual([...waiting].sort((a, b) => a - b));
    }
  });

  test("opens the solution behind a review row", async ({ page }) => {
    // The seeded row rather than the first one, for the reason the test above records.
    await page
      .getByRole("main")
      .locator("tbody tr")
      .getByRole("link", { name: "Alice Student" })
      .first()
      .click();

    await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
    // Course, assignment, the student, then the attempt -- the same words the page's own title
    // uses. The student is X-031's: a teacher arriving from a queue could not tell whose it was.
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("Solutions")).toHaveCount(0);
    await expect(breadcrumb.getByRole("link")).toHaveCount(3);
    await expect(breadcrumb.getByRole("link").nth(1)).toHaveAttribute(
      "href",
      /\/en\/assignments\/[0-9a-f-]+$/,
    );
    await expect(breadcrumb.getByRole("link", { name: "Alice Student" })).toHaveAttribute(
      "href",
      /\/en\/assignments\/[0-9a-f-]+\/users\/[0-9a-f-]+$/,
    );
    await expect(breadcrumb.getByText(/^Attempt \d+$/)).toBeVisible();
  });

  test("lists the deadlines coming up in the groups they teach", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Coming up in your groups" })).toBeVisible();

    // A teacher has no solution of their own here, so the two columns about one are absent.
    const table = page.getByRole("region", { name: "Coming up in your groups" }).getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Deadline" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Status" })).toHaveCount(0);
  });
});

test("shows both halves to someone who studies in one group and teaches another", async ({
  page,
}) => {
  await signIn(page, SUPERVISOR_STUDENT);

  // IA §4.1: "Both sections are visible simultaneously if applicable. No mode switch."
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "My teaching" })).toBeVisible();
});

test.describe("the calendar", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, STUDENT);
  });

  test("draws the month as whole Monday-to-Sunday weeks", async ({ page }) => {
    const calendar = page.getByRole("region", { name: "Calendar" });
    await expect(calendar).toBeVisible();

    const headers = calendar.getByRole("columnheader");
    await expect(headers).toHaveCount(7);
    await expect(headers.first()).toHaveText("Mon");
    await expect(headers.last()).toHaveText("Sun");

    // Whole weeks, so every row has all seven days.
    const cells = await calendar
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.querySelectorAll("td").length));
    expect(cells.length).toBeGreaterThan(3);
    expect(new Set(cells)).toEqual(new Set([7]));
  });

  test("marks the deadlines and links each to its assignment", async ({ page }) => {
    // The seeded student's two assignments fall in September 2026; ask for that month directly,
    // which also exercises the ?month= deep-link.
    await page.goto("/en/dashboard?tab=calendar&month=2026-09");

    const calendar = page.getByRole("region", { name: "Calendar" });
    await expect(calendar.getByRole("heading", { name: /September 2026/ })).toBeVisible();

    const entries = calendar.getByRole("link", { name: /Echo Greeting/ });
    await expect(entries.first()).toBeVisible();
    await entries.first().click();
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  });

  test("steps to the next month and back without client-side state", async ({ page }) => {
    await page.goto("/en/dashboard?tab=calendar&month=2026-09");
    const calendar = page.getByRole("region", { name: "Calendar" });

    await calendar.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=2026-10/);
    await expect(calendar.getByRole("heading", { name: /October 2026/ })).toBeVisible();

    await calendar.getByRole("link", { name: "Previous month" }).click();
    await expect(page).toHaveURL(/month=2026-09/);
    await expect(calendar.getByRole("heading", { name: /September 2026/ })).toBeVisible();
  });

  test("falls back to the current month for an unparseable one", async ({ page }) => {
    await page.goto("/en/dashboard?tab=calendar&month=not-a-month");

    const now = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await expect(
      page.getByRole("region", { name: "Calendar" }).getByRole("heading", { name: now }),
    ).toBeVisible();
  });

  test("renders the section a ?tab= deep-link names first, without hiding the others", async ({
    page,
  }) => {
    await signIn(page, SUPERVISOR_STUDENT); // studies in one group, teaches another: three sections

    // `evaluateAll` is a one-shot query with no auto-wait, and since PF-002 the page's own content
    // streams in behind the shell -- so each read waits for the sections to be there first.
    const headings = page.getByRole("main").getByRole("heading", { level: 2 });
    const headingNames = async () => {
      await expect(headings).toHaveCount(3);
      return headings.evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
    };

    expect(await headingNames()).toEqual(["My studies", "My teaching", "Calendar"]);

    await page.goto("/en/dashboard?tab=calendar");
    // Reordered, not filtered -- IA §4.1's "no mode switch".
    expect(await headingNames()).toEqual(["Calendar", "My studies", "My teaching"]);

    await page.goto("/en/dashboard?tab=teacher");
    expect(await headingNames()).toEqual(["My teaching", "My studies", "Calendar"]);
  });
});
