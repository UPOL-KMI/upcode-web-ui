import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededAssignments } from "./helpers/core-api";

/**
 * Every attempt at one assignment (T-003).
 *
 * The companion to the class-progress table the assignment screen already had (S-013): that one is
 * a row per student, this one a row per submission -- so the seeded student, who submitted three
 * times, appears three times here and once there.
 *
 * Both are gated on `viewAssignmentSolutions`, and the two halves of that are asserted separately:
 * a teacher is offered the link and can read the page, a student is offered neither and is refused
 * the URL if they type it.
 */
async function openSeededAssignment(page: import("@playwright/test").Page) {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "[seed] Intro to Programming", level: 1 }),
  ).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);

  // **By id, not `.first()` (PF-010).** All three of the group's assignments render the same label
  // -- an assignment is displayed by its exercise's name and the seed makes three from one on
  // purpose -- so `.first()` picked whichever the table sorted first. This spec asserts submissions are listed, so it needs the one the seed submits to.
  // The click still goes through the group page, so the link itself is still exercised.
  const target = (await seededAssignments()).primary;
  await page.getByRole("main").locator(`a[href$="/assignments/${target}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/en/assignments/${target}$`));
}

test("lists every attempt, one row per submission", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  const main = page.getByRole("main");
  await main.getByRole("link", { name: "All submissions" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/solutions$/);
  await expect(main.getByRole("heading", { name: "All submissions", level: 1 })).toBeVisible();

  // The seeded student submitted three times to this assignment; the class-progress table on the
  // previous screen shows them once. That difference is the whole point of this screen.
  const rows = main.getByRole("row").filter({ hasText: "Alice Student" });
  await expect(rows).toHaveCount(3);
  await expect(main.getByRole("row").filter({ hasText: "Bob Classmate" })).toHaveCount(1);

  // Each row opens its own solution, not the author's best one.
  const notes = await main.getByRole("row").filter({ hasText: "Alice Student" }).allInnerTexts();
  expect(notes.join(" ")).toContain("[seed] correct");
  expect(notes.join(" ")).toContain("[seed] wrong");
});

test("filters and sorts without leaving the URL behind", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "All submissions" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/solutions$/);

  const main = page.getByRole("main");
  await main.getByPlaceholder("Filter by name or note").fill("Bob");
  await expect(main.getByRole("row").filter({ hasText: "Alice Student" })).toHaveCount(0);
  await expect(main.getByRole("row").filter({ hasText: "Bob Classmate" })).toHaveCount(1);

  // The filter is in the URL, which is what makes the view shareable (brief §9).
  await expect(page).toHaveURL(/[?&]solutions-[0-9a-f]+-q=Bob/);
  const shared = page.url();
  await page.goto(shared);
  await expect(main.getByRole("row").filter({ hasText: "Alice Student" })).toHaveCount(0);
});

test("offers a teacher the class's work as one archive", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "All submissions" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/solutions$/);

  // The link is offered on `viewAssignmentSolutions` -- the hint that means "may read other
  // people's attempts" -- rather than on whatever would make the request succeed: core-api gates
  // the endpoint on the assignment's own `canViewDetail`, which a student holds, and then filters
  // the archive's contents per student. A student would get an archive of their own work, which is
  // not what this button offers (G-006).
  const download = main.getByRole("link", { name: "Download the best solutions" });
  await expect(download).toHaveAttribute(
    "href",
    /^\/api\/assignments\/[0-9a-f-]+\/best-solutions$/,
  );

  // What comes back cannot be asserted as a ZIP here: "the best solution" is decided by points and
  // no evaluation on this host produces any (DEC-031), so core-api builds no archive and answers
  // `Content-Length: 0`. The app turns that into an honest refusal rather than a nought-byte file.
  const response = await page.request.get((await download.getAttribute("href"))!);
  expect([200, 409]).toContain(response.status());
  if (response.status() === 409) {
    expect(await response.json()).toMatchObject({ error: "There is nothing to download." });
  } else {
    expect(response.headers()["content-type"]).toContain("zip");
  }
});

test("opens the solution behind a row", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);
  await page.getByRole("main").getByRole("link", { name: "All submissions" }).click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/solutions$/);

  await page.getByRole("main").getByRole("link", { name: "Bob Classmate" }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);
});

test("is neither offered to a student nor readable by one", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededAssignment(page);

  await expect(page.getByRole("main").getByRole("link", { name: "All submissions" })).toHaveCount(
    0,
  );

  // And typing the URL is refused, rather than quietly showing everyone's work: a hidden link is
  // not authorisation (brief §3.4).
  await page.goto(`${page.url()}/solutions`);
  await expect(page.getByRole("main")).toContainText("Forbidden");
});
