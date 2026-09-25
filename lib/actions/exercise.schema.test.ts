import { describe, expect, it } from "vitest";

import { exerciseSettingsSchema } from "./exercise.schema";

const settings = {
  texts: [{ locale: "cs", name: "Úloha", text: "Zadání", description: "", link: "" }],
  difficulty: "easy" as const,
  isPublic: true,
  isLocked: false,
  mergeJudgeLogs: true,
  solutionFilesLimit: null,
  solutionSizeLimit: null,
};

describe("exerciseSettingsSchema", () => {
  it("does not carry the optimistic lock", () => {
    // X-023. Held as a form field, `version` froze at mount: the first save succeeded and
    // incremented it server-side, and the second sent the stale number back and was refused with
    // "the exercise was edited in the meantime" -- the reader's own earlier save, reported as
    // somebody else's. It is passed to the action from the current props instead, so putting it
    // back here would reintroduce the bug in a way nothing else would catch.
    const parsed = exerciseSettingsSchema.parse({ ...settings, version: 4 });
    expect(parsed).not.toHaveProperty("version");
  });

  it("accepts a complete set of settings", () => {
    expect(exerciseSettingsSchema.safeParse(settings).success).toBe(true);
  });
});
