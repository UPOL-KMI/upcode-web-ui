import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * The exercise catalog (T-020).
 *
 * Everything asserted here goes through **core-api**, not through a table sorting itself in the
 * browser: the searching, the filtering and the paging are all query parameters, which is the
 * whole design of this screen. The seed provides enough exercises for that to mean something --
 * two pages, tags, and one archived exercise that must stay out of the way until asked for.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("narrows the catalog through core-api, not in the browser", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { name: "Exercises", level: 1 })).toBeVisible();
  // The count is core-api's, and it counts what matched rather than what is on screen.
  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();

  await main.getByLabel("Search").fill("Merge Sort");
  await main.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/[?&]q=Merge\+Sort/);
  await expect(main.getByText("Showing 1–1 of 1.")).toBeVisible();
  await expect(main.getByRole("link", { name: "[seed] Merge Sort" })).toBeVisible();
});

test("pages through what the query matched", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  const total = Number(
    (await main.getByText(/^Showing 1–20 of \d+\.$/).innerText()).match(/of (\d+)/)![1],
  );
  expect(total).toBeGreaterThan(20);

  await main.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/[?&]page=1$/);
  await expect(main.getByText(`Showing 21–${total} of ${total}.`)).toBeVisible();
  // The last page offers no next one, and the first no previous.
  await expect(main.getByRole("link", { name: "Next" })).toHaveCount(0);
  await main.getByRole("link", { name: "Previous" }).click();
  await expect(main.getByRole("link", { name: "Previous" })).toHaveCount(0);
});

test("narrows to one author, and offers the author their own in one click", async ({ page }) => {
  // The seed splits the catalog cleanly between two authors, which is what makes both halves of
  // this assertable: the filter's total has to be smaller than the unfiltered one and larger than
  // zero, not merely different (G-018).
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  const countOf = async () =>
    Number(
      (await main.getByText(/^Showing \d+–\d+ of \d+\.$/).innerText()).match(/of (\d+)\./)![1],
    );
  const everyone = await countOf();

  // "Only mine" is a link, not a third state of the select: it is a destination rather than a
  // filter to combine, and it drops the page so the reader lands on the first of their own.
  await main.getByRole("link", { name: "Only mine" }).click();
  await expect(page).toHaveURL(/[?&]author=[0-9a-f-]+/);
  const mine = await countOf();
  expect(mine).toBeGreaterThan(0);
  expect(mine).toBeLessThan(everyone);

  // Every row on screen is now that author's, which is the claim the filter makes. The sixth
  // column: name, difficulty, environments, group, tags, author. (X-016 inserted Group before
  // Tags, which moved this by one -- the reason the index is spelled out rather than guessed.)
  const authorCells = main.locator("tbody tr td:nth-child(6)");
  for (const text of await authorCells.allInnerTexts()) {
    expect(text.trim()).toBe("Sam Supervisor");
  }

  // The way back is the same control, and it says so.
  await expect(main.getByRole("link", { name: "Only mine" })).toHaveCount(0);
  await main.getByRole("link", { name: "Everyone's" }).click();
  await expect(page).not.toHaveURL(/[?&]author=/);
  expect(await countOf()).toBe(everyone);

  // The select carries the same filter for somebody who is not the author they want.
  await main.getByLabel("Author").selectOption({ label: "Sam Supervisor" });
  await main.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/[?&]author=[0-9a-f-]+/);
  expect(await countOf()).toBe(mine);
});

test("keeps archived exercises out of the way until they are asked for", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises?q=Retired");
  const main = page.getByRole("main");
  await expect(main.getByText("Nothing matches those filters.")).toBeVisible();

  await page.goto("/en/exercises?q=Retired&archived=only");
  const row = main.getByRole("row").filter({ hasText: "[seed] Retired Puzzle" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Archived");
});

test("is not a student's screen", async ({ page }) => {
  await signIn(page, STUDENT, "/en/exercises");
  // core-api's `canViewAll` on exercises: a student reads the assignments made from them, never
  // the catalog itself.
  await expect(page.getByRole("main")).toContainText("Forbidden");
});

test("never prints a message key where a difficulty belongs", async ({ page }) => {
  // G-031b: core-api serves `''` for an exercise nobody set a difficulty on, and next-intl answers
  // a missing key with the key path -- so the catalog used to show readers `difficulty.` and log a
  // `MISSING_MESSAGE` per row. Whether this instance *has* such an exercise is not this spec's to
  // arrange; `exercise-edit.spec.ts` makes one and reads the fallback off it.
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  await expect(main.getByText(/^Showing 1–20 of \d+\.$/)).toBeVisible();
  await expect(main).not.toContainText("difficulty.");
});

test("narrows the catalogue to what a group may be given, ancestors included", async ({ page }) => {
  await signIn(page, SUPERVISOR, "/en/exercises");
  const main = page.getByRole("main");

  const countOf = async () =>
    Number(
      (await main.getByText(/^Showing \d+–\d+ of \d+\.$/).innerText()).match(/of (\d+)\./)![1],
    );
  const everyone = await countOf();

  // The column exists and names where each exercise is stored.
  await expect(main.getByRole("columnheader", { name: "Group" })).toBeVisible();

  // Filtering by the seeded course narrows the list without emptying it.
  await main.getByLabel("Group").selectOption({ index: 1 });
  await main.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/[?&]group=[0-9a-f-]+/);

  const narrowed = await countOf();
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThanOrEqual(everyone);

  // **The sentence that stops the closure reading as a bug.** Filtering by one group lists
  // exercises stored in its ancestors, so the Group column can name a different group than the
  // filter does -- which is correct and needs saying.
  await expect(main.getByText(/including the ones stored in its parent groups/i)).toBeVisible();

  // And it is a shareable address, like every other filter on this screen.
  const url = page.url();
  await page.goto(url);
  expect(await countOf()).toBe(narrowed);
});
