"use client";

import { useCallback, useRef, useState } from "react";

import { UploadError, uploadFileChunked, type UploadedFile } from "./chunked-upload";

/**
 * Per-file upload state for `components/upload/file-upload.tsx` (D-005). Holds a list rather than
 * a single file because every legacy upload surface is multi-file (solution archives, exercise
 * attachments, supplementary files), and because a failed file has to stay visible next to the
 * ones that succeeded instead of taking the whole batch down with it.
 *
 * Uploads run concurrently, one `uploadFileChunked` call each. The legacy app serialises them;
 * not reproduced deliberately, since its own chunk loop is what serialises the actual bytes per
 * file, and the adaptive chunk sizing already reacts to a slower link. If this turns out to
 * matter on a constrained connection, the fix is a small queue here, not a change to the protocol.
 */
export type UploadStatus = "uploading" | "done" | "failed";

export interface UploadItem {
  /** Stable across re-renders and independent of the file name -- two files may share a name. */
  key: string;
  name: string;
  size: number;
  status: UploadStatus;
  uploadedBytes: number;
  /**
   * core-api's stable error code, or a local one (`network`, `digest-mismatch`, `canceled`, and
   * `duplicate-name` for a file refused before upload because one of that name is already here).
   */
  errorCode?: string;
  errorMessage?: string;
  /** The finished `UploadedFile` entity, the thing a consuming form actually submits. */
  uploaded?: UploadedFile;
}

export interface UseFileUploadOptions {
  /**
   * Called whenever the set of successfully uploaded files changes. Invoked from the completion
   * handler and from remove/reset -- all real event contexts, never from render or an effect:
   * notifying a parent during render triggers React's "cannot update a component while rendering
   * a different component" error, and routing it through an effect instead just trades that for
   * a `setState`-in-effect the lint config (rightly) rejects. Ordered by completion, which is the
   * order core-api receives them in; a set of attachments has no meaningful display order anyway.
   */
  onUploadedFilesChange?: (files: UploadedFile[]) => void;
}

export interface UseFileUpload {
  items: UploadItem[];
  addFiles: (files: Iterable<File>) => void;
  cancel: (key: string) => void;
  remove: (key: string) => void;
  reset: () => void;
  /** Every file that finished, for the consuming form's hidden field / Server Action payload. */
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
}

export function useFileUpload({ onUploadedFilesChange }: UseFileUploadOptions = {}): UseFileUpload {
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  // The authoritative uploaded set for notification purposes, kept beside `items` rather than
  // derived from it: it has to be readable and updatable from event handlers, where reading
  // `items` would see a stale closure.
  const uploaded = useRef(new Map<string, UploadedFile>());
  // The names of the files that are uploading or uploaded, for refusing a second one of the same
  // name: every upload surface ends up as a set of files keyed by name -- a solution is stored as
  // an archive -- and core-api answered two `report.jpg`s with a bare 500 ("Target entry already
  // exists"), after which the uploads it had already taken were gone too.
  const names = useRef(new Map<string, string>());
  const announce = useCallback(() => {
    onUploadedFilesChange?.([...uploaded.current.values()]);
  }, [onUploadedFilesChange]);

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      for (const file of files) {
        const key =
          globalThis.crypto?.randomUUID?.() ?? `${file.name}-${Date.now()}-${Math.random()}`;
        if ([...names.current.values()].includes(file.name)) {
          setItems((current) => [
            ...current,
            {
              key,
              name: file.name,
              size: file.size,
              status: "failed",
              uploadedBytes: 0,
              errorCode: "duplicate-name",
            },
          ]);
          continue;
        }
        names.current.set(key, file.name);
        const controller = new AbortController();
        controllers.current.set(key, controller);

        setItems((current) => [
          ...current,
          { key, name: file.name, size: file.size, status: "uploading", uploadedBytes: 0 },
        ]);

        void uploadFileChunked(file, {
          signal: controller.signal,
          onProgress: (uploadedBytes) => patch(key, { uploadedBytes }),
        })
          .then((result) => {
            uploaded.current.set(key, result);
            patch(key, { status: "done", uploaded: result, uploadedBytes: file.size });
            announce();
          })
          .catch((error: unknown) => {
            // An abort is a user action, not a failure to explain -- the row is removed rather
            // than left showing an error the user just caused on purpose.
            names.current.delete(key);
            if (error instanceof DOMException && error.name === "AbortError") {
              setItems((current) => current.filter((item) => item.key !== key));
              return;
            }
            patch(key, {
              status: "failed",
              errorCode: error instanceof UploadError ? error.code : "unknown",
              errorMessage: error instanceof Error ? error.message : undefined,
            });
          })
          .finally(() => controllers.current.delete(key));
      }
    },
    [patch, announce],
  );

  const cancel = useCallback((key: string) => {
    controllers.current.get(key)?.abort();
  }, []);

  const remove = useCallback(
    (key: string) => {
      controllers.current.get(key)?.abort();
      names.current.delete(key);
      setItems((current) => current.filter((item) => item.key !== key));
      if (uploaded.current.delete(key)) announce();
    },
    [announce],
  );

  const reset = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    names.current.clear();
    setItems([]);
    if (uploaded.current.size > 0) {
      uploaded.current.clear();
      announce();
    }
  }, [announce]);

  return {
    items,
    addFiles,
    cancel,
    remove,
    reset,
    uploadedFiles: items.flatMap((item) => (item.uploaded ? [item.uploaded] : [])),
    isUploading: items.some((item) => item.status === "uploading"),
  };
}
