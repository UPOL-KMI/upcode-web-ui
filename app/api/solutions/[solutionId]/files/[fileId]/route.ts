import { NextResponse } from "next/server";

import { getSolutionFiles } from "@/lib/api/solution-files";
import { inlineContentType } from "@/lib/code/preview";
import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * One submitted file, handed to the browser -- the download beside a file this app will not render
 * as text (a PDF, a presentation, an image).
 *
 * Addressed by the solution it belongs to, then asked of core-api's generic
 * `/uploaded-files/{id}/download`, for the reason G-015's pipeline route gives at length: without
 * the ownership check this would be a "download any uploaded file by id" proxy and an oracle for
 * ids nobody asked about. core-api authorises the call itself as well; this narrows what can be
 * asked of it.
 *
 * **Entries inside a submitted archive are not downloadable here.** Their bytes exist only inside
 * the containing zip, and core-api has no endpoint that extracts one -- the page offers the whole
 * archive instead, which is why such a file arrives with no download link and this route refuses
 * it rather than streaming the enclosing archive under the entry's name.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ solutionId: string; fileId: string }> },
) {
  const { solutionId, fileId } = await params;
  // `?inline` asks for the bytes labelled so a browser will render them. What that may be is not
  // this route's decision -- `inlineContentType` answers `null` for anything unvetted, and the
  // header then stays the attachment it has always been.
  const wantsInline = new URL(request.url).searchParams.has("inline");

  const files = await getSolutionFiles(solutionId);
  const file = files.find((candidate) => candidate.fileId === fileId && candidate.entry === null);
  if (!file) {
    return NextResponse.json({ error: "No such file on this solution." }, { status: 404 });
  }

  return streamFromCoreApi(
    `/uploaded-files/${encodeURIComponent(fileId)}/download`,
    file.name || "solution-file",
    wantsInline ? inlineContentType(file.name) : null,
  );
}
