"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PreviewKind } from "@/lib/code/preview";
import { readSpreadsheet, SpreadsheetError, type Grid } from "@/lib/users/spreadsheet";

import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog/dialog";

/**
 * A submitted file shown rather than only offered (X-025).
 *
 * **The download stays above this, always.** Seeing a file in the browser must not take away the
 * ability to fetch it and check it with something else -- a teacher marking a diagram may well
 * want it open in a real viewer.
 *
 * Which files arrive here is `lib/code/preview.ts`'s decision and not this component's: a short
 * list of raster images, PDF and the two spreadsheet formats, with SVG and HTML deliberately
 * absent because they are markup a student writes and this app would otherwise run.
 */
export function FilePreview({
  kind,
  href,
  name,
}: {
  kind: PreviewKind;
  /** The `?inline` variant of the file's own route -- the only address served with a real type. */
  href: string;
  name: string;
}) {
  if (kind === "image") return <ImagePreview href={href} name={name} />;
  if (kind === "pdf") return <PdfPreview href={href} name={name} />;
  return <SheetPreview href={href} name={name} />;
}

function ImagePreview({ href, name }: { href: string; name: string }) {
  const t = useTranslations("Sources");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="block cursor-zoom-in rounded-md border border-border bg-muted/30 p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={t("preview.enlarge", { name })}
        >
          {/* Not `next/image`: the bytes come from a route that authorises per solution, the
              dimensions are unknown until it loads, and optimising a submitted file would mean
              running it through the image pipeline -- which is work, and a surface, for nothing. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={name} className="max-h-96 w-auto object-contain" />
        </button>
      </DialogTrigger>
      <DialogContent title={name} className="max-w-[90vw]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={name} className="max-h-[75vh] w-auto object-contain" />
      </DialogContent>
    </Dialog>
  );
}

/**
 * **The browser's own viewer, in a frame with no `sandbox` attribute** -- and that is a deliberate
 * weakening, measured rather than assumed.
 *
 * `sandbox=""` rendered a blank rectangle, and so did `sandbox="allow-scripts"` in the operator's
 * own browser: Chromium will not instantiate its PDF plugin for a frame in an opaque origin, which
 * is exactly what a sandbox without `allow-same-origin` creates. Adding `allow-same-origin` back
 * alongside `allow-scripts` is equivalent to no sandbox at all for same-origin content, so the
 * attribute would have been theatre.
 *
 * What actually keeps this narrow is upstream of the frame:
 *
 * - **Only vetted types are ever relabelled.** `inlineContentType` answers `null` for anything not
 *   on the list, so HTML, SVG and XML never reach an `<iframe>` at all -- they stay
 *   `application/octet-stream; attachment` and download. That is the attack this needed to stop.
 * - **`X-Content-Type-Options: nosniff`** on the response, so a file cannot be re-interpreted as
 *   something else.
 * - **A PDF cannot script the embedding page.** Whatever JavaScript a document carries runs inside
 *   the viewer, with no access to this page's DOM, cookies or session.
 *
 * What remains is a malicious PDF attacking the browser's own viewer -- which is the same risk the
 * teacher takes by pressing the download button above and opening the file, and that button is
 * there either way.
 */
function PdfPreview({ href, name }: { href: string; name: string }) {
  const t = useTranslations("Sources");

  return (
    <iframe
      src={href}
      title={t("preview.document", { name })}
      className="h-[70vh] w-full rounded-md border border-border bg-muted/30"
    />
  );
}

/**
 * A spreadsheet read **in the browser**, by the same module the roster import uses (X-015).
 *
 * It already parses xlsx, the legacy binary xls, an HTML table and delimited text into a grid of
 * strings, and it was written to run on either side. Reading it here rather than on the server
 * keeps the bytes on one round trip -- the same one the download would have made -- and keeps a
 * forty-megabyte parse out of the render path of a page that has other files on it.
 */
function SheetPreview({ href, name }: { href: string; name: string }) {
  const t = useTranslations("Sources");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(href);
        if (!response.ok) throw new Error(String(response.status));
        const rows = await readSpreadsheet(await response.arrayBuffer());
        if (!cancelled) setGrid(rows);
      } catch (error) {
        if (cancelled) return;
        setFailed(error instanceof SpreadsheetError ? error.reason : "unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [href]);

  if (failed !== null) {
    return <p className="text-sm text-muted-foreground">{t("preview.sheetFailed")}</p>;
  }
  if (grid === null) {
    return <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>;
  }

  const [header, ...rows] = grid;

  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{name}</caption>
        <thead className="sticky top-0 bg-muted text-xs">
          <tr>
            {(header ?? []).map((cell, index) => (
              <th key={index} scope="col" className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-border">
              {row.map((cell, index) => (
                <td key={index} className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
