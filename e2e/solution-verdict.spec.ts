import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import {
  firstSeededSolution,
  restoreSolutionVerdict,
  SEEDED_CORRECT_NOTE,
} from "./helpers/core-api";

/**
 * The teacher's verdict on a solution: which attempt counts, and what it is worth (G-001).
 *
 * **Set from the grading bar since X-031**, not from a card on the solution screen: points are
 * awarded where the work is read, so these tests open the files in grading mode.
 *
 * **These tests mutate a seeded solution and put it back**, rather than creating one of their own:
 * submitting a solution and waiting for it to be evaluated is S-014's ground, and on this host no
 * evaluation can succeed at all (DEC-031), so a freshly created solution would be in a state no
 * teacher ever sees. The `finally` restores both fields to the values the seed leaves -- not
 * accepted, no override, no bonus -- so the run is idempotent and every other spec reading that
 * solution sees what it expects.
 *
 * Accepting is offered only on an attempt that does not count, and the seeded solution is its
 * author's only one, so it is not exercised here; `lib/grading/standing.test.ts` covers when the bar
 * offers it.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

test("awards points the evaluation did not, and clears them again", async ({ page }) => {
  const { id, maxPoints } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  try {
    await signIn(page, SUPERADMIN, `/en/solutions/${id}/sources?grade=1`);
    const main = page.getByRole("main");
    const points = main.getByLabel(/^Points \(max \d+\)$/);
    await expect(points).toBeVisible();

    // Full marks is one click and the save's own confirmation, which reads the numbers back.
    await main.getByRole("button", { name: `Full marks (${maxPoints})` }).click();
    const fullDialog = page.getByRole("alertdialog");
    await expect(fullDialog).toContainText(`${maxPoints} of ${maxPoints} points`);
    await fullDialog.getByRole("button", { name: "Save the points" }).click();
    // The field carrying the awarded value is the honest signal that the round trip is done --
    // typing while the refresh behind the save is in flight let it put the old value back.
    await expect(points).toHaveValue(String(maxPoints));
    // Graded now, so the bar says the points count: the author's only attempt is their best.
    await expect(main.getByText(/^The best solution\./)).toBeVisible();

    // And the number in between, typed.
    await points.fill("3");
    await main.getByLabel("Bonus", { exact: true }).fill("2");
    await main.getByRole("button", { name: "Save", exact: true }).click();
    const saveDialog = page.getByRole("alertdialog");
    await expect(saveDialog).toContainText(`3 of ${maxPoints} points plus a bonus of 2`);
    await saveDialog.getByRole("button", { name: "Save the points" }).click();
    await expect(points).toHaveValue("3");

    // An empty field hands the solution back to whatever the evaluation said.
    await points.fill("");
    await main.getByLabel("Bonus", { exact: true }).fill("0");
    await main.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Save the points" }).click();
    await expect(points).toHaveValue("");
  } finally {
    await restoreSolutionVerdict(id);
  }
});

test("is offered to no student, on their own solution or anyone else's", async ({ page }) => {
  await signIn(page, STUDENT, "/en/dashboard");
  const { id } = await firstSeededSolution(SEEDED_CORRECT_NOTE);

  // The overview no longer carries a verdict at all, and the flag in the grading address is not a
  // permission: either page is refused outright or shown without the controls.
  for (const path of [`/en/solutions/${id}`, `/en/solutions/${id}/sources?grade=1`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "The teacher's verdict" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Accept the solution" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  }
});
