import { test, expect } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";

/**
 * Shadow assignments (S-020): the kind with nothing to submit, whose points a teacher types in.
 *
 * Reached the way a reader reaches it -- from the group's assignments tab, where the seeded
 * `[seed] Oral Exam` is listed under its own heading rather than mixed into a table whose columns
 * are all about submissions.
 */
async function openSeededShadowAssignment(page: import("@playwright/test").Page) {
  await page.goto("/en/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: "[seed] Intro to Programming", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/groups\/[0-9a-f-]+/);
  await page.goto(`${page.url().split("?")[0]}?tab=assignments`);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Shadow assignments" })).toBeVisible();
  await main.getByRole("link", { name: "[seed] Oral Exam" }).click();
  await expect(page).toHaveURL(/\/en\/shadow-assignments\/[0-9a-f-]+$/);
}

test("tells a student what they were awarded, and nothing about anyone else", async ({ page }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededShadowAssignment(page);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "My points" })).toBeVisible();
  // `exact`, because the assignment's own name differs from the note only in case.
  await expect(main.getByText("[seed] oral exam", { exact: true })).toBeVisible();
  // core-api sends a student only their own record, so there is no table of everyone to hide.
  await expect(main.getByRole("heading", { name: "Students’ points" })).toHaveCount(0);
  // Nothing is submitted for a shadow assignment, so nothing offers to.
  await expect(main.getByRole("link", { name: /submit/i })).toHaveCount(0);
  await expect(main.getByText("The deadline is informative")).toBeVisible();
});

test("lets a teacher change what was awarded", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededShadowAssignment(page);

  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "Alice Student" });
  await expect(row).toBeVisible();

  // Set to a known value and back, so the test says the same thing whatever it started from.
  for (const points of ["9", "8"]) {
    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Points").fill(points);
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("The points were changed.", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: points, exact: true })).toBeVisible();
  }
});

/**
 * X-032: every student has a row, graded or not, and the quick buttons only prefill it. Nothing is
 * saved here, so the fixture stays as the seed made it.
 */
test("lists an ungraded student, and the quick buttons only prefill the row", async ({ page }) => {
  const cookie = await loginAndGetCookie(SUPERADMIN);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await openSeededShadowAssignment(page);

  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "Bob Classmate" });
  await expect(row.getByText("Not graded", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Prefill 0 points" }).click();
  await expect(row.getByLabel("Points")).toHaveValue("0");
  await row.getByRole("button", { name: "Cancel" }).click();
  await expect(row.getByText("Not graded", { exact: true })).toBeVisible();

  await row.getByRole("checkbox", { name: /Select/ }).check();
  await expect(main.getByText("1 student selected")).toBeVisible();
  await main.getByRole("button", { name: "Clear selection" }).click();
  await expect(main.getByText("1 student selected")).toHaveCount(0);
});
