/**
 * Which submitted files this app will show, and under what media type (X-025).
 *
 * **A short list of what *can* be shown, and everything else is a download.** That is the opposite
 * of `binary-files.ts`, which lists what is *not* text, and the inversion is deliberate: that list
 * may be incomplete without harm, because a type nobody named is still fetched and caught by
 * core-api's own `malformedCharacters`. This one must be complete in the other direction -- a type
 * nobody vetted must not be handed to a browser to interpret.
 *
 * **Nothing here is allowed to execute.** Until this existed, every submitted file was served as
 * `application/octet-stream` with `Content-Disposition: attachment`, so a student's `.svg` or
 * `.html` could do nothing at all; that safety was an accident of the headers, not a decision.
 * Inlining changes it, and on this app's own origin a student's markup would run with this app's
 * rights. So SVG, HTML and XML are **not previewable** -- they are neither raster images this can
 * render nor documents worth the risk -- and the PDF that is previewable goes into an
 * `<iframe sandbox>` with neither `allow-scripts` nor `allow-same-origin`.
 */
export type PreviewKind = "image" | "pdf" | "sheet";

/**
 * Raster images only. **`svg` is absent on purpose** and is the single most important omission in
 * this file: it is markup with scripting, not a picture.
 */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
};

/** Read by `lib/users/spreadsheet.ts`, which the roster import (X-015) already relies on. A `.csv`
 *  is not here: it is text, so it already renders as itself and a table would say no more. */
const SHEET_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

const PDF_TYPE = "application/pdf";

function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/** What kind of preview a name earns, or `null` for "offer the download and say nothing else". */
export function previewKindOf(name: string): PreviewKind | null {
  const extension = extensionOf(name);
  if (extension in IMAGE_TYPES) return "image";
  if (extension === "pdf") return "pdf";
  if (extension in SHEET_TYPES) return "sheet";
  return null;
}

/**
 * The media type to serve a previewable file as, or `null` when it must stay a download.
 *
 * core-api answers `application/octet-stream` for everything, so a browser handed that in an
 * `<iframe>` downloads it instead of rendering it. This is the only place a real type is decided,
 * and it answers for exactly the names `previewKindOf` accepts -- a file this app will not show is
 * a file it will not relabel either.
 */
export function inlineContentType(name: string): string | null {
  const extension = extensionOf(name);
  return (
    IMAGE_TYPES[extension] ?? SHEET_TYPES[extension] ?? (extension === "pdf" ? PDF_TYPE : null)
  );
}

/**
 * Above this, the preview is not offered and the download is.
 *
 * The file listing carries the size, so this is decided **before** anything is fetched -- the point
 * is not to pull forty megabytes in order to discover that showing it was a bad idea. A file over
 * the limit can still be commented on: a comment is bound to the file's name, not to a preview.
 */
export const PREVIEW_SIZE_LIMIT = 8 * 1024 * 1024;

export function isPreviewable(name: string, size: number): boolean {
  return previewKindOf(name) !== null && size <= PREVIEW_SIZE_LIMIT;
}
