import { test, expect } from "@playwright/test";

import { STUDENT } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { firstSeededSolution, SEEDED_CORRECT_NOTE } from "./helpers/core-api";

/**
 * The solution screen (S-015).
 *
 * **Since PF-016 the seeded solutions are genuinely evaluated**, so the test-by-test table is
 * checked against real data here rather than taken on trust -- which is what this comment used to
 * say was impossible on this machine. What still has no fixture is the other direction: an
 * infrastructure failure, a compilation failure and the limit-exceeded badges are built from
 * core-api's own view factories and have never been seen with data, because nothing on this
 * deployment produces those states any more (PF-017).
 */
test("shows what happened to a submitted solution", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);

  const attempt = page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first();
  await attempt.click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: /^Attempt \d+$/ })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Summary" })).toBeVisible();
  // The summary lands first; the evaluation is a tab away since X-026.
  await main.getByRole("link", { name: "Automatic tests" }).click();
  await expect(main.getByRole("heading", { name: "Evaluation" })).toBeVisible();
});

test("shows a per-test verdict for a solution that was actually evaluated", async ({
  page,
  context,
}) => {
  // **This test used to assert the opposite**, and the comment it carried said so: every seeded
  // submission failed with "Isolate init error", which made an infrastructure failure the one
  // evaluation state reachable here. Since PF-016 the seeded solutions are graded, so the state a
  // student on this box sees is a real verdict -- and that is what the screen must render.
  // The infrastructure-failure rendering is still there and is now the case with no fixture,
  // which is PF-017's territory rather than something to fake here.
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  const { id } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  await page.goto(`/en/solutions/${id}`);

  const main = page.getByRole("main");
  // The tally is on the overview beside the points; the table it summarises is on the tests tab.
  await expect(main.getByText("1 of 1 tests passed")).toBeVisible();
  await main.getByRole("link", { name: "Automatic tests" }).click();
  await expect(main.getByRole("heading", { name: "Evaluation" })).toBeVisible();
  await expect(main.getByRole("cell", { name: "Test 1" })).toBeVisible();
  await expect(main.getByRole("cell", { name: "Passed", exact: true })).toBeVisible();
});

test("links back to the assignment it belongs to", async ({ page, context }) => {
  const cookie = await loginAndGetCookie(STUDENT);
  await context.addCookies([{ ...cookie, url: baseURL }]);

  await page.goto("/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  const assignmentUrl = page.url();
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Attempt \d+$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Back to the assignment" }).click();
  await expect(page).toHaveURL(assignmentUrl);
});
