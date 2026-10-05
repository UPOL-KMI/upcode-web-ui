import { test, expect } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import type { SeedAccount } from "./helpers/accounts";
import type { Page } from "@playwright/test";

/**
 * Grading a class from the submissions table (X-031).
 *
 * Read-only on purpose: saving points writes to a seeded solution the rest of the suite reads, and
 * mails its author a minute later. What is asserted is the way through -- the table's "Grade"
 * link, the bar it opens onto, and the queue moving -- which is what this ticket added.
 */
async function signIn(page: Page, account: SeedAccount): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
}

async function openSubmissionsAsTeacher(page: Page): Promise<void> {
  await signIn(page, SUPERVISOR);
  await page.goto("/en/dashboard");
  await page
    .getByRole("region", { name: "Coming up in your groups" })
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=solutions`);
  await expect(
    page.getByRole("main").getByRole("heading", { name: "The group's progress" }),
  ).toBeVisible();
}

test("opens a student's best solution with the class queue around it", async ({ page }) => {
  await openSubmissionsAsTeacher(page);

  const grade = page
    .getByRole("main")
    .getByRole("link", { name: /^Grade the solution of / })
    .first();
  await expect(grade).toBeVisible();
  await grade.click();

  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\/sources\?grade=1$/);
  const bar = page.getByRole("navigation", { name: "Grading the class" });
  await expect(bar).toBeVisible();
  await expect(bar.getByText(/^Student \d+\/\d+$/)).toBeVisible();
  // The points sit beside the code.
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

test("keeps the queue when switching to the discussion tab", async ({ page }) => {
  await openSubmissionsAsTeacher(page);
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Grade the solution of / })
    .first()
    .click();
  await expect(page).toHaveURL(/\?grade=1$/);

  await page.getByRole("link", { name: /^Discussion/ }).click();
  await expect(page).toHaveURL(/\?tab=discussion&grade=1$/);
  await expect(page.getByRole("navigation", { name: "Grading the class" })).toBeVisible();
});

test("moves to the next student in the table's order", async ({ page }) => {
  await openSubmissionsAsTeacher(page);
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Grade the solution of / })
    .first()
    .click();
  const bar = page.getByRole("navigation", { name: "Grading the class" });
  await expect(bar).toBeVisible();

  const position = await bar.getByText(/^Student \d+\/\d+$/).innerText();
  const [, current, total] = /(\d+)\/(\d+)/.exec(position)!.map(Number);
  test.skip(current === total, "only one student with a solution here, so there is no next one");

  const before = page.url();
  await bar.getByRole("link", { name: "Next →" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(bar.getByText(`Student ${current! + 1}/${total}`)).toBeVisible();
});

test("never shows the grading bar to the student who wrote the solution", async ({ page }) => {
  await signIn(page, STUDENT);
  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}?tab=solutions`);

  const attempt = page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first();
  test.skip((await attempt.count()) === 0, "this student has no attempt on the first assignment");
  const href = await attempt.getAttribute("href");
  // The flag in the address is not a permission: the page asks core-api and gets no queue.
  await page.goto(`${href}/sources?grade=1`);
  await expect(page.getByRole("navigation", { name: "Grading the class" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
});
