import { describe, expect, it } from "vitest";

import { inlineContentType, isPreviewable, PREVIEW_SIZE_LIMIT, previewKindOf } from "./preview";

/**
 * The list that decides what a browser is allowed to interpret (X-025), so the cases that matter
 * most are the refusals.
 */
describe("previewKindOf", () => {
  it("shows raster images", () => {
    for (const name of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.bmp", "g.avif"]) {
      expect(previewKindOf(name)).toBe("image");
    }
  });

  it("shows PDFs and spreadsheets", () => {
    expect(previewKindOf("report.pdf")).toBe("pdf");
    expect(previewKindOf("data.xlsx")).toBe("sheet");
    expect(previewKindOf("old.xls")).toBe("sheet");
  });

  it("**refuses SVG, HTML and XML**, which are markup a student writes and this app would run", () => {
    for (const name of ["drawing.svg", "page.html", "page.htm", "page.xhtml", "data.xml"]) {
      expect(previewKindOf(name)).toBeNull();
      expect(inlineContentType(name)).toBeNull();
    }
  });

  it("refuses everything nobody vetted", () => {
    for (const name of ["thesis.docx", "slides.pptx", "archive.zip", "a.out", "notes.txt"]) {
      expect(previewKindOf(name)).toBeNull();
    }
  });

  it("reads the extension off the last dot of the last path segment", () => {
    expect(previewKindOf("src/img.v2.png")).toBe("image");
    expect(previewKindOf("weird.png/notafile")).toBeNull();
    expect(previewKindOf(".hidden")).toBeNull();
    expect(previewKindOf("noextension")).toBeNull();
  });
});

describe("inlineContentType", () => {
  it("answers a real type for what can be shown", () => {
    expect(inlineContentType("a.png")).toBe("image/png");
    expect(inlineContentType("a.jpg")).toBe("image/jpeg");
    expect(inlineContentType("report.pdf")).toBe("application/pdf");
    expect(inlineContentType("data.xlsx")).toContain("spreadsheetml");
  });

  it("answers nothing for a file that stays a download, so it is never relabelled", () => {
    expect(inlineContentType("thesis.docx")).toBeNull();
    expect(inlineContentType("drawing.svg")).toBeNull();
  });
});

describe("isPreviewable", () => {
  it("refuses a previewable type that is too big to be worth fetching", () => {
    expect(isPreviewable("photo.png", 1024)).toBe(true);
    expect(isPreviewable("photo.png", PREVIEW_SIZE_LIMIT)).toBe(true);
    expect(isPreviewable("photo.png", PREVIEW_SIZE_LIMIT + 1)).toBe(false);
  });

  it("refuses an unpreviewable type at any size", () => {
    expect(isPreviewable("thesis.docx", 10)).toBe(false);
  });
});
