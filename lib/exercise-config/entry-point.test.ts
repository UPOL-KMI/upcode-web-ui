import { describe, expect, it } from "vitest";

import { deliveredAs, entryPointChoices, entryPointIsUndelivered } from "./entry-point";

const HARNESS = ["main.py", "helper.py", "test01.in"];

describe("entryPointIsUndelivered", () => {
  it("warns about the case that cost an afternoon: an exercise file named and never delivered", () => {
    expect(entryPointIsUndelivered("main.py", [], HARNESS)).toBe(true);
  });

  it("is quiet once a pair delivers it", () => {
    expect(
      entryPointIsUndelivered("main.py", [{ file: "main.py", name: "main.py" }], HARNESS),
    ).toBe(false);
  });

  it("is quiet when the pair delivers it under its own name, the second box being optional", () => {
    expect(entryPointIsUndelivered("main.py", [{ file: "main.py", name: "" }], HARNESS)).toBe(
      false,
    );
  });

  it("follows the rename rather than the source file", () => {
    // Delivered as `run.py`, so `main.py` is still not in the box -- and `run.py` would be.
    expect(entryPointIsUndelivered("main.py", [{ file: "main.py", name: "run.py" }], HARNESS)).toBe(
      true,
    );
    expect(
      entryPointIsUndelivered(
        "run.py",
        [{ file: "main.py", name: "run.py" }],
        [...HARNESS, "run.py"],
      ),
    ).toBe(false);
  });

  it("says nothing about a name the student is expected to submit", () => {
    // Not one of the exercise's own files, so it can only be the submission's -- and whether that
    // arrives is the student's business, not a misconfiguration.
    expect(entryPointIsUndelivered("solution.py", [], HARNESS)).toBe(false);
  });

  it("says nothing when no entry point is chosen", () => {
    expect(entryPointIsUndelivered("", [], HARNESS)).toBe(false);
    expect(entryPointIsUndelivered("   ", [], HARNESS)).toBe(false);
  });

  it("ignores a pair with no file chosen, which delivers nothing", () => {
    expect(entryPointIsUndelivered("main.py", [{ file: "", name: "main.py" }], HARNESS)).toBe(true);
  });

  it("finds the delivery among several pairs", () => {
    expect(
      entryPointIsUndelivered(
        "main.py",
        [
          { file: "helper.py", name: "" },
          { file: "main.py", name: "" },
        ],
        HARNESS,
      ),
    ).toBe(false);
  });
});

describe("deliveredAs", () => {
  it("prefers the typed name and falls back to the file's own", () => {
    expect(deliveredAs({ file: "main.py", name: "run.py" })).toBe("run.py");
    expect(deliveredAs({ file: "main.py", name: "" })).toBe("main.py");
    expect(deliveredAs({ file: "main.py", name: "  " })).toBe("main.py");
  });
});

describe("entryPointChoices", () => {
  it("is empty until an extra file is added, whatever the exercise has attached", () => {
    expect(entryPointChoices([])).toEqual([]);
  });

  it("offers what a pair delivers, under its own name", () => {
    expect(entryPointChoices([{ file: "main.py", name: "" }])).toEqual(["main.py"]);
  });

  it("offers a renamed delivery under the name it lands as", () => {
    expect(entryPointChoices([{ file: "main.py", name: "run.py" }])).toEqual(["run.py"]);
  });

  it("does not repeat a name two pairs deliver", () => {
    expect(
      entryPointChoices([
        { file: "a.py", name: "run.py" },
        { file: "b.py", name: "run.py" },
      ]),
    ).toEqual(["run.py"]);
  });

  it("ignores a pair with no file chosen", () => {
    expect(entryPointChoices([{ file: "", name: "ghost.py" }])).toEqual([]);
  });
});
