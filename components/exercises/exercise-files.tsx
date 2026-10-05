"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  attachExerciseFiles,
  createExerciseFileLink,
  deleteExerciseFile,
  deleteExerciseFileLink,
} from "@/lib/actions/exercise-files";
import type { ExerciseFileEntry, ExerciseFileLink } from "@/lib/api/exercise-files";
import { formatBytes } from "@/lib/format/bytes";
import type { ActionResult } from "@/lib/forms/action-result";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { FileUpload } from "@/components/upload/file-upload";
import { buttonClasses } from "@/components/button";
import { DownloadIcon } from "@/components/icons";

/**
 * The exercise's own files, and the named links into them (T-023).
 *
 * These are the files the **evaluation** uses -- expected outputs, test data, a custom judge --
 * and T-009's configuration editor is their only real consumer: every file field there is a select
 * over this list, which is why that screen had nothing to offer until this one existed.
 *
 * **Uploading is additive and a name is an identity.** core-api keeps what is already attached and
 * replaces only a file of the same name, carrying that file's links over to the replacement -- so
 * uploading a corrected `expected.txt` fixes the exercise rather than breaking every link into it.
 * The upload itself goes through S-014's chunked Route Handler, not a Server Action (brief §6.7);
 * what this component sends is the ids of files core-api has already stored.
 *
 * **Deleting a file is not confirmed lightly**, because the configuration may name it: core-api
 * will let the file go and the configuration will keep the name, which is a test that fails at
 * evaluation time with nothing on screen to point at. The dialog says so.
 *
 * A **link** gives one file a short key and a role that may fetch it, and `%%key%%` in the
 * exercise text then renders as a working URL. A link whose role is nobody-in-particular is a
 * genuinely public address -- which is the point, for an exercise text that becomes a handout --
 * and the form says as much rather than leaving it to be discovered.
 */
const ROLES = ["", "student", "supervisor", "empowered-supervisor", "superadmin"] as const;

export function ExerciseFiles({
  exerciseId,
  files,
  links,
  archiveUrl,
  readOnly,
}: {
  exerciseId: string;
  files: ExerciseFileEntry[];
  links: ExerciseFileLink[];
  archiveUrl: string;
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseEdit.files");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [deleting, setDeleting] = useState<ExerciseFileEntry | null>(null);
  const [linkFile, setLinkFile] = useState("");
  const [linkKey, setLinkKey] = useState("");
  const [linkRole, setLinkRole] = useState<string>("");
  const [linkSaveName, setLinkSaveName] = useState("");

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(result.formError ?? t("errors.generic"));
      return false;
    }
    toast.success(t(successKey));
    router.refresh();
    return true;
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("explain")}</p>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setDeleting(file)}
                    className={buttonClasses("outline", "xs", "shrink-0")}
                  >
                    {t("remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <a
            href={archiveUrl}
            className="inline-flex items-center gap-1.5 self-start text-sm text-primary underline underline-offset-2"
          >
            <DownloadIcon />
            {t("downloadAll")}
          </a>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("upload")}</h3>
          <FileUpload onUploadedFilesChange={setUploaded} disabled={pending} />
          <div>
            <button
              type="button"
              disabled={pending || uploaded.length === 0}
              onClick={() =>
                void run(
                  () =>
                    attachExerciseFiles(
                      exerciseId,
                      uploaded.map((file) => file.id),
                    ),
                  "attached",
                ).then((ok) => {
                  if (ok) setUploaded([]);
                })
              }
              className={buttonClasses("primary", "sm")}
            >
              {t("attach", { count: uploaded.length })}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("links.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("links.explain")}</p>

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("links.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {links.map((link) => {
              const file = files.find((entry) => entry.id === link.exerciseFileId);
              return (
                <li key={link.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <code className="text-sm">{`%%${link.key}%%`}</code>
                    <span className="block truncate text-xs text-muted-foreground">
                      {file?.name ?? t("links.missingFile")}
                      {link.saveName ? ` → ${link.saveName}` : ""}
                      {" · "}
                      {link.requiredRole
                        ? t("links.requiresRole", { role: link.requiredRole })
                        : t("links.public")}
                    </span>
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void run(() => deleteExerciseFileLink(exerciseId, link.id), "links.deleted")
                      }
                      className={buttonClasses("outline", "xs", "shrink-0")}
                    >
                      {t("links.delete")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly && files.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t("links.file")}
              <select
                className={input}
                aria-label={t("links.file")}
                value={linkFile}
                onChange={(event) => setLinkFile(event.target.value)}
              >
                <option value="">{t("links.choose")}</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("links.key")}
              <input
                type="text"
                maxLength={16}
                className={`${input} w-32 font-mono`}
                value={linkKey}
                onChange={(event) => setLinkKey(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("links.role")}
              <select
                className={input}
                aria-label={t("links.role")}
                value={linkRole}
                onChange={(event) => setLinkRole(event.target.value)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role === "" ? t("links.public") : t(`links.roles.${role}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("links.saveName")}
              <input
                type="text"
                className={`${input} w-40 font-mono`}
                value={linkSaveName}
                onChange={(event) => setLinkSaveName(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={pending || !linkFile || !linkKey}
              onClick={() =>
                void run(
                  () =>
                    createExerciseFileLink(exerciseId, {
                      exerciseFileId: linkFile,
                      key: linkKey,
                      requiredRole: linkRole === "" ? null : linkRole,
                      saveName: linkSaveName,
                    }),
                  "links.created",
                ).then((ok) => {
                  if (ok) {
                    setLinkFile("");
                    setLinkKey("");
                    setLinkRole("");
                    setLinkSaveName("");
                  }
                })
              }
              className={buttonClasses("outline", "sm")}
            >
              {t("links.create")}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmRemove.title")}
        description={t("confirmRemove.description", { name: deleting?.name ?? "" })}
        confirmLabel={t("confirmRemove.confirm")}
        pending={pending}
        onConfirm={() => {
          const file = deleting;
          setDeleting(null);
          if (file) void run(() => deleteExerciseFile(exerciseId, file.id), "removed");
        }}
      />
    </div>
  );
}
