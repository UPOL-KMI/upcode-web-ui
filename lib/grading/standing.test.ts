import { describe, expect, it } from "vitest";

import { attemptStanding, type AttemptForStanding } from "./standing";

function attempt(overrides: Partial<AttemptForStanding> & { id: string }): AttemptForStanding {
  return {
    attemptIndex: 1,
    createdAt: 1,
    gained: 0,
    bonus: 0,
    accepted: false,
    isBest: false,
    failed: false,
    ...overrides,
  };
}

describe("attemptStanding", () => {
  const first = attempt({ id: "a", attemptIndex: 1, createdAt: 1, gained: 5 });
  const second = attempt({ id: "b", attemptIndex: 2, createdAt: 2, gained: 8, isBest: true });

  it("says the best attempt counts", () => {
    expect(attemptStanding("b", [first, second]).standing).toEqual({ kind: "best" });
  });

  it("names the attempt that counts instead", () => {
    expect(attemptStanding("a", [first, second]).standing).toEqual({
      kind: "elsewhere",
      counted: second,
    });
  });

  it("says an accepted attempt counts because it was accepted", () => {
    const accepted = { ...first, accepted: true, isBest: true };
    expect(attemptStanding("a", [accepted, { ...second, isBest: false }]).standing).toEqual({
      kind: "accepted",
    });
  });

  it("says an attempt whose evaluation failed never counts, even accepted", () => {
    const failed = { ...first, accepted: true, failed: true };
    expect(attemptStanding("a", [failed, second]).standing).toEqual({
      kind: "failed",
      counted: second,
    });
  });

  it("points to the newest attempt from an older one, and not from the newest", () => {
    expect(attemptStanding("a", [first, second]).latest).toBe(second);
    expect(attemptStanding("b", [first, second]).latest).toBeNull();
  });

  it("says nothing about an attempt it was not given", () => {
    expect(attemptStanding("x", [first, second])).toEqual({ standing: null, latest: null });
  });
});
