import { test, expect } from "@playwright/test";

import { STUDENT, SUPERVISOR } from "./helpers/accounts";
import { loginAndGetCookie } from "./helpers/auth";
import { baseURL } from "./helpers/base-url";
import { seededGroupId } from "./helpers/core-api";

/**
 * Importing a roster into a course (AD-009, reopened by X-015).
 *
 * **Nothing here runs an import.** An invitation cannot be recalled and an enrolment cannot be
 * undone from this app at all (S-026 is still open), so a spec that pressed the button would send
 * mail and poison every later spec's idea of who studies where -- the same reason
 * `accept-invitation.spec.ts` stops short of accepting. What is asserted is everything up to that
 * button: who may reach the screen, and what a downloaded file turns into once it is read. Both are
 * where this feature actually goes wrong, and the sending half was verified by hand against the
 * running deployment (`docs/PROGRESS.md`).
 *
 * The fixture is written here rather than committed. A real STAG export carries a student's name,
 * address and study number, and the columns are what is being tested, not the person.
 */
const STAG_COLUMNS = [
  "osCislo",
  "jmeno",
  "prijmeni",
  "titulPred",
  "titulZa",
  "stav",
  "userName",
  "fakultaSp",
  "email",
  "casPrihlaseni",
];

const STAG_CSV = [
  STAG_COLUMNS.join(";"),
  "R25238;Lukáš;BENEŠ;;;S;benelu09;PRF;e2e.benes@seed.recodex.local;46212.45",
  "R25239;Jana;NOVÁKOVÁ-DVOŘÁKOVÁ;Bc.;;S;novaja00;PRF;e2e.novakova@seed.recodex.local;46212.46",
].join("\n");

let groupId: string;

test.beforeAll(async () => {
  groupId = await seededGroupId();
});

test.describe("as a teacher of the course", () => {
  test.beforeEach(async ({ page }) => {
    const cookie = await loginAndGetCookie(SUPERVISOR);
    await page.context().addCookies([{ ...cookie, url: baseURL }]);
  });

  test("offers the import from the students tab, on inviteStudents rather than on being an admin", async ({
    page,
  }) => {
    await page.goto(`/en/groups/${groupId}?tab=students`);

    const link = page.getByRole("link", { name: /import people into this group/i });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/users/import\\?group=${groupId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/import/i);
  });

  test("reads a STAG export, keeps six columns of it and says what it dropped", async ({
    page,
  }) => {
    await page.goto(`/en/users/import?group=${groupId}`);

    await page.getByLabel(/file listing the students/i).setInputFiles({
      name: "getStudentiByPredmet.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(STAG_CSV, "utf-8"),
    });

    const main = page.getByRole("main");
    await expect(main).toContainText(/read 2 rows from getStudentiByPredmet\.csv/i);
    // Six of the ten columns mean something; `stav` and `userName` are among the four that do not,
    // and dropping them is the whole reason an uploaded file is narrowed rather than pasted.
    await expect(main).toContainText(/columns used:.*stag/i);
    await expect(main).toContainText(/ignored 4 columns:.*stav/i);
    await expect(main).toContainText(/capitals repaired:.*BENEŠ → Beneš/);

    // The box is filled with what will be sent, and it is still editable.
    const box = page.getByRole("textbox", { name: /the table/i });
    await expect(box).toHaveValue(/^stag\tjmeno\tprijmeni/);
    await expect(box).toHaveValue(/Nováková-Dvořáková/);

    // And the preview the screen already had reads it back as two people with a study number each.
    await expect(main).toContainText(/2 people read/i);
    await expect(main).toContainText("R25238");
    await expect(main).toContainText("Bc. Jana Nováková-Dvořáková");
  });

  test("says so in words when the file carries no column it recognises", async ({ page }) => {
    await page.goto(`/en/users/import?group=${groupId}`);

    await page.getByLabel(/file listing the students/i).setInputFiles({
      name: "nonsense.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("alpha;beta\n1;2", "utf-8"),
    });

    await expect(page.getByRole("alert")).toContainText(/no row naming the columns/i);
  });
});

test.describe("as a student of the course", () => {
  test.beforeEach(async ({ page }) => {
    const cookie = await loginAndGetCookie(STUDENT);
    await page.context().addCookies([{ ...cookie, url: baseURL }]);
  });

  test("is neither offered the import nor allowed to open it", async ({ page }) => {
    await page.goto(`/en/groups/${groupId}?tab=students`);
    await expect(page.getByRole("link", { name: /import people into this group/i })).toHaveCount(0);

    await page.goto(`/en/users/import?group=${groupId}`);
    await expect(page.getByRole("main")).toContainText(/not allowed|permission/i);
  });

  test("cannot reach the instance-wide import either, which is nobody's but the administrator's", async ({
    page,
  }) => {
    await page.goto("/en/users/import");
    await expect(page.getByRole("main")).toContainText(/not allowed|permission/i);
  });
});
