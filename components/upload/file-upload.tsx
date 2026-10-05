"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { formatBytes } from "@/lib/format/bytes";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/limits";
import { useFileUpload } from "@/lib/upload/use-file-upload";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

export interface FileUploadProps {
  /** Called whenever the set of successfully uploaded files changes, for the consuming form. */
  onUploadedFilesChange?: (files: UploadedFile[]) => void;
  accept?: string;
  disabled?: boolean;
  /**
   * The **consumer's** ceiling, where it is lower than the deployment's -- an assignment sets its
   * own `solutionSizeLimit` (64 KiB on the seeded one, against a 512 MiB deployment ceiling), and
   * stating the number that will actually refuse the file is the point of showing a number at all.
   * Display only: enforcement stays where it already is, in the orchestrator and the Route Handler
   * for the deployment ceiling, and in core-api for the assignment's own.
   */
  maxBytes?: number;
}

/**
 * The upload surface (D-005): drop zone + file picker, one progress row per file, cancel, and
 * per-file error reporting. All of the actual protocol lives in `lib/upload/chunked-upload.ts`;
 * this component only renders the state `useFileUpload` exposes.
 *
 * The 512 MiB ceiling is stated in the UI rather than only enforced, so an oversized file is a
 * readable message next to the control instead of a rejection after the user has already waited.
 * Enforcement itself happens twice more, in the orchestrator and in the Route Handler -- see
 * `lib/upload/limits.ts`.
 *
 * Drag-and-drop is progressive: the same `<input type="file">` is the real control (keyboard
 * reachable, screen-reader labelled), and the drop zone is a convenience layer over it, not a
 * replacement for it. `aria-live` on the file list means completions and failures are announced
 * rather than only shown, matching the accessibility bar brief §9 sets.
 */
export function FileUpload({ onUploadedFilesChange, accept, disabled, maxBytes }: FileUploadProps) {
  const t = useTranslations("Upload");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { items, addFiles, cancel, remove } = useFileUpload({ onUploadedFilesChange });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = ""; // re-selecting the same file must re-fire onChange
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
          isDraggingOver ? "border-ring bg-accent/40" : "border-input"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <label htmlFor={inputId} className="cursor-pointer text-sm font-medium text-foreground">
          {t("dropzone")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("maxSize", {
            size: formatBytes(Math.min(maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES)),
          })}
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      </div>

      {items.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-2">
          {items.map((item) => {
            const percent =
              item.status === "done"
                ? 100
                : item.size === 0
                  ? 0
                  : Math.round((item.uploadedBytes / item.size) * 100);

            return (
              <li key={item.key} className="flex flex-col gap-1 rounded-md border border-input p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatBytes(item.size)}
                  </span>
                </div>

                {item.status === "uploading" && (
                  <>
                    <progress
                      value={item.uploadedBytes}
                      max={item.size || 1}
                      aria-label={t("progressLabel", { name: item.name })}
                      className="h-1.5 w-full"
                    />
                    <div className="flex items-center justify-between gap-3">
                      {/* Kept out of the list's live region: it changes several times a second,
                          and the `<progress>` above exposes the same number on demand. */}
                      <span aria-hidden="true" className="text-sm text-muted-foreground">
                        {t("uploading", { percent })}
                      </span>
                      <button
                        type="button"
                        onClick={() => cancel(item.key)}
                        className="text-sm underline underline-offset-2"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </>
                )}

                {item.status === "done" && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t("done")}</span>
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      className="text-sm underline underline-offset-2"
                    >
                      {t("remove")}
                    </button>
                  </div>
                )}

                {item.status === "failed" && (
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-sm text-destructive">
                      {item.errorCode === "duplicate-name"
                        ? t("duplicateName")
                        : (item.errorMessage ?? t("failed"))}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      className="text-sm underline underline-offset-2"
                    >
                      {t("remove")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
