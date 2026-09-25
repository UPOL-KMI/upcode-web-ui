import "server-only";

import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * Handing a file core-api holds to the browser, without buffering it here (S-017, G-004, G-013,
 * G-014).
 *
 * A Route Handler cannot go through `lib/api/client.ts`: that unwraps core-api's `{success,
 * payload}` envelope and would reject a ZIP outright. Streaming `response.body` passes the bytes
 * on as they arrive. The token is read from the httpOnly cookie here and never reaches the browser
 * (brief §5) -- the link a page renders points at this app.
 *
 * **`response.ok` is the wrong test, and it took a live check to see it.** core-api answers a
 * result archive whose job never produced one with **HTTP 202** and its own JSON envelope --
 * `{"success": false, "error": {"message": "Submission is not evaluated yet", "code": "202-000"}}`
 * -- because `NotReadyException` is a 2xx in this API. `ok` is true for 202, so a route that trusts
 * it hands the browser a file called `.zip` containing that sentence. The test is therefore **200
 * and not JSON**, and anything else is forwarded with core-api's own status so the reason survives
 * instead of becoming this app's 500.
 */
export async function streamFromCoreApi(
  path: string,
  fallbackFilename: string,
  /**
   * Serve the bytes for the browser to *render* rather than save (X-025).
   *
   * core-api answers `application/octet-stream` with `Content-Disposition: attachment` for every
   * file it has, so a browser handed one in an `<img>` or an `<iframe>` saves it instead of showing
   * it. Passing a media type here replaces both headers. Only `lib/code/preview.ts` decides what
   * may be passed, and it answers `null` for anything a student could make execute.
   */
  inlineContentType?: string | null,
): Promise<Response> {
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  // An explicit `Content-Length: 0` means core-api built no archive at all -- an empty ZIP is 22
  // bytes, not none -- and handing the browser a nought-byte `.zip` is a file that cannot be
  // opened. G-006 meets this on every request here, because "the best solution" of a student is
  // decided by points and no evaluation on this host produces any (DEC-031). A streamed response
  // carries no length at all, so only the explicit zero is read this way.
  const empty = response.headers.get("content-length") === "0";
  if (response.status !== 200 || contentType.includes("json") || empty || !response.body) {
    const envelope = contentType.includes("json")
      ? ((await response.json().catch(() => null)) as { error?: { message?: string } } | null)
      : null;
    return NextResponse.json(
      {
        error:
          envelope?.error?.message ??
          (empty ? "There is nothing to download." : "The file could not be downloaded."),
      },
      // A 2xx that is not a file is not a success as far as the browser is concerned; 409 says
      // "not in a state that can answer this" without inventing a server error.
      {
        status: empty
          ? 409
          : response.status === 200
            ? 502
            : response.status < 300
              ? 409
              : response.status,
      },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", inlineContentType || contentType || "application/zip");
  headers.set(
    "Content-Disposition",
    inlineContentType
      ? `inline; filename="${fallbackFilename}"`
      : (response.headers.get("content-disposition") ??
          `attachment; filename="${fallbackFilename}"`),
  );
  // Belt and braces for the one thing this must never do: a type that slipped through would still
  // not be sniffed into something executable.
  headers.set("X-Content-Type-Options", "nosniff");
  const length = response.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(response.body, { status: 200, headers });
}
