import { describe, expect, it } from "vitest";

import { fixShoutedName } from "./name-case";

/**
 * The half of the STAG import that changes what a person is called (X-015), so the tests are
 * mostly about what it must **not** touch.
 */
describe("fixShoutedName", () => {
  it("repairs the capitals a STAG export writes surnames in", () => {
    expect(fixShoutedName("BENEŠ")).toBe("Beneš");
    expect(fixShoutedName("NOVÁK")).toBe("Novák");
    expect(fixShoutedName("ŘEHÁČKOVÁ")).toBe("Řeháčková");
  });

  it("capitalises after a hyphen and after an apostrophe", () => {
    expect(fixShoutedName("NOVÁKOVÁ-DVOŘÁKOVÁ")).toBe("Nováková-Dvořáková");
    expect(fixShoutedName("O'BRIEN")).toBe("O'Brien");
    expect(fixShoutedName("O’BRIEN")).toBe("O’Brien");
    expect(fixShoutedName("DE LA CRUZ")).toBe("De La Cruz");
  });

  it("leaves a name alone the moment one lower-case letter says the spelling is real", () => {
    expect(fixShoutedName("van der Berg")).toBe("van der Berg");
    expect(fixShoutedName("McDonald")).toBe("McDonald");
    expect(fixShoutedName("de la Cruz")).toBe("de la Cruz");
    expect(fixShoutedName("Beneš")).toBe("Beneš");
  });

  it("leaves alone anything too short to be a name, and anything with no letters", () => {
    expect(fixShoutedName("X")).toBe("X");
    expect(fixShoutedName("")).toBe("");
    expect(fixShoutedName("123")).toBe("123");
  });
});
