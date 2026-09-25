import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { STUDENT, SUPERADMIN } from "./helpers/accounts";
import type { SeedAccount } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import {
  deleteSolutionIfPresent,
  deleteSubmissionIfPresent,
  firstSeededSolution,
  SEEDED_WRONG_NOTE,
  solutionSubmissionIds,
} from "./helpers/core-api";
import { cleanUpCreatedSolutions } from "./helpers/created-solutions";

/**
 * Running a solution again, and removing one (G-002).
 *
 * **The deletion test submits its own solution rather than removing a seeded one**, for the obvious
 * reason: a seeded solution deleted is gone, and half the suite reads them. Submitting one is the
 * only way to have something disposable, and it goes through the real upload path because that is
 * the only way to create a solution at all -- there is no fixture endpoint.
 *
 * **Nothing here asserts an evaluation result.** This host cannot produce a passing one (DEC-031)
 * and a resubmit's job fails within a second, so what is asserted is that the re-run *started* and
 * that the screen carries the monitor channel it was given -- which is the part this ticket built.
 */
async function signIn(page: Page, account: SeedAccount, path: string): Promise<void> {
  const cookie = await loginAndGetCookie(account);
  await page.context().addCookies([{ ...cookie, url: baseURL }]);
  await page.goto(path);
}

const trackSolution = cleanUpCreatedSolutions();

/** Submits a throwaway solution as the student and returns its id. */
async function submitThrowaway(page: Page): Promise<string> {
  await signIn(page, STUDENT, "/en/dashboard");
  await page.getByRole("main").locator("tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Submit a solution" }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "solution.py",
    mimeType: "text/x-python",
    buffer: Buffer.from('print("Hello, ReCodEx!")\n'),
  });
  const environment = page.getByLabel("Language", { exact: true });
  await expect(environment).toBeEnabled({ timeout: 30_000 });
  await page.getByLabel("Note").fill("[e2e] to be deleted");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/[0-9a-f-]+\?monitor=/, { timeout: 30_000 });

  // Remembered before this function returns, so a test that fails anywhere after it still has the
  // solution swept -- the `finally` blocks below are skipped by a Playwright timeout (PF-011).
  const id = trackSolution(page.url());
  if (id === null) throw new Error("no solution id after submitting");
  return id;
}

test("runs a solution again, and carries the monitor channel of the new job", async ({ page }) => {
  const { id } = await firstSeededSolution(SEEDED_WRONG_NOTE);
  // A resubmit adds an evaluation run to this very solution, so the run it adds has to come back
  // out again -- otherwise every pass of this suite leaves the seeded solution one deeper, which is
  // precisely the drift that broke `assignment-solutions.spec.ts` before G-001 fixed it.
  const before = await solutionSubmissionIds(id);
  try {
    // Re-running lives under "Automatic tests" since X-026, and the tab is part of the address.
    await signIn(page, SUPERADMIN, `/en/solutions/${id}?tab=tests`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Running it again" })).toBeVisible();

    await main.getByRole("button", { name: "Run it again", exact: true }).click();
    // Confirmed since the operator's round: a re-run costs a worker an evaluation's worth of time.
    await page.getByRole("alertdialog").getByRole("button", { name: "Run it again" }).click();

    // core-api hands the monitor channel out once, in the response to the resubmit that created the
    // job. If it is not in this URL it is gone, and the progress display has nothing to listen to.
    await expect(page).toHaveURL(new RegExp(`/en/solutions/${id}\\?monitor=[^&]+&tasks=\\d+$`), {
      timeout: 30_000,
    });
  } finally {
    const after = await solutionSubmissionIds(id);
    for (const submissionId of after.filter((s) => !before.includes(s))) {
      await deleteSubmissionIfPresent(submissionId);
    }
  }
});

test("offers a debug run beside the ordinary one", async ({ page }) => {
  const { id } = await firstSeededSolution(SEEDED_WRONG_NOTE);
  await signIn(page, SUPERADMIN, `/en/solutions/${id}?tab=tests`);
  const main = page.getByRole("main");

  await expect(main.getByRole("button", { name: "Run it again in debug mode" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Run it again", exact: true })).toBeVisible();
});

test("lists the runs behind a solution, and reads or removes one", async ({ page }) => {
  // The other half of G-004: the exit codes are asserted on the design-system fixture, because no
  // evaluation on this host ever produces a test result (DEC-031). This half is about the runs
  // themselves, which do exist.
  const { id } = await firstSeededSolution(SEEDED_WRONG_NOTE);
  const before = await solutionSubmissionIds(id);
  try {
    await signIn(page, SUPERADMIN, `/en/solutions/${id}?tab=tests`);
    const main = page.getByRole("main");

    // One run, so there is nothing to choose between and core-api would refuse to delete it.
    await expect(main.getByRole("heading", { name: "Runs of this solution" })).toBeHidden();

    await main.getByRole("button", { name: "Run it again in debug mode" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Run it in debug mode" })
      .click();
    await expect(main.getByRole("heading", { name: "Runs of this solution" })).toBeVisible({
      timeout: 30_000,
    });

    const runs = main.getByRole("listitem").filter({ has: page.locator("time") });
    await expect(runs).toHaveCount(2);
    // The newest is the one the points come from, and it says so rather than leaving the reader
    // to infer it from the order.
    await expect(runs.first()).toContainText("Scored by this");
    await expect(runs.first()).toContainText("Debug");

    // Each run is a URL of its own, and the page says when the one on screen is not the scored one.
    await runs.last().getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/en/solutions/${id}\\?submission=[0-9a-f-]+$`));
    // The link carries no `tab=`, so this also asserts that a URL naming a run opens the tab the
    // runs are on rather than the overview (X-026).
    await expect(main.getByText("This is not the run the solution is scored by")).toBeVisible();

    // An id that belongs to no run of this solution is a wrong address, not the last run.
    await page.goto(`/en/solutions/${id}?submission=00000000-0000-0000-0000-000000000000`);
    await expect(main.getByRole("heading", { name: "Page not found" })).toBeVisible();
  } finally {
    const after = await solutionSubmissionIds(id);
    for (const submissionId of after.filter((s) => !before.includes(s))) {
      await deleteSubmissionIfPresent(submissionId);
    }
  }
});

test("deletes a solution, saying first what goes with it", async ({ page }) => {
  const solutionId = await submitThrowaway(page);
  try {
    await signIn(page, SUPERADMIN, `/en/solutions/${solutionId}?tab=tests`);
    const main = page.getByRole("main");

    await main.getByRole("button", { name: "Delete this solution" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("whole review with its comments");
    await dialog.getByRole("button", { name: "Delete it" }).click();

    // Deleting leaves the screen it deleted, for the list it belonged to.
    await expect(page).toHaveURL(/\/en\/assignments\/[0-9a-f-]+\/solutions$/, { timeout: 15_000 });
    await page.goto(`/en/solutions/${solutionId}`);
    await expect(page.getByRole("heading", { name: "Running it again" })).toHaveCount(0);
  } finally {
    await deleteSolutionIfPresent(solutionId);
  }
});

test("offers re-running every solution from the assignment's own list", async ({ page }) => {
  const { id } = await firstSeededSolution(SEEDED_WRONG_NOTE);
  await signIn(page, SUPERADMIN, `/en/solutions/${id}`);
  await page.getByRole("link", { name: "Back to the assignment" }).click();
  await page.getByRole("link", { name: "All submissions" }).click();
  await expect(page).toHaveURL(/\/solutions$/);

  // Only offered, not pressed: it starts a background job over every submission of the assignment,
  // and this suite has no way to wait for one without asserting on the worker's own timing.
  await expect(page.getByRole("button", { name: "Run all of them again" })).toBeVisible();
});

test("is offered to no student", async ({ page }) => {
  const { id } = await firstSeededSolution(SEEDED_WRONG_NOTE);
  await signIn(page, STUDENT, `/en/solutions/${id}?tab=tests`);

  // Asked for on the tab the buttons would be on, so this says they are refused rather than merely
  // elsewhere.
  await expect(page.getByRole("heading", { name: "Running it again" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run it again", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete this solution" })).toHaveCount(0);
});
