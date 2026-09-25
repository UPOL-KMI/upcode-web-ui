"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { syncAssignmentWithExercise } from "@/lib/actions/assignment";
import {
  FILES_AND_LINKS,
  defaultSelection,
  selectedParts,
  syncItems,
  type SyncItemKey,
} from "@/lib/assignments/sync-parts";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Re-syncing an assignment with its exercise, one part at a time (X-020).
 *
 * **It used to send everything, and that was wrong in one specific way.** Sending no options is
 * core-api's "all of them", so a teacher picking up a changed test file also lost the text they had
 * adjusted for their own group -- silently, and with no way back, because an override makes the
 * assignment's copy the newer one and core-api then stops calling the locale out of sync at all.
 * The original decision to offer no choice was right about eleven of the twelve parts and missed
 * the one a teacher diverges on deliberately.
 *
 * So the button now asks. What it offers, and what starts ticked, is the caller's business --
 * `defaultSelection` says why the two entry points differ rather than repeating it here.
 */
export function SyncWithExercise({
  assignmentId,
  exerciseId,
  exerciseName,
  stale,
  from,
  label,
  /** Something the reader would lose, said before they press rather than after. */
  warning,
}: {
  assignmentId: string;
  exerciseId: string;
  /** `null` where the reader may not read the exercise -- the sentence manages without it. */
  exerciseName: string | null;
  /** What core-api reports as fallen behind; everything else is shown but cannot be ticked. */
  stale: readonly string[];
  from: "drift" | "override";
  label?: string;
  warning?: string;
}) {
  const t = useTranslations("Assignment.sync");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const { items, unknown } = syncItems(stale);
  const [checked, setChecked] = useState<Set<SyncItemKey>>(
    () => new Set(defaultSelection(items, from)),
  );

  const toggle = (key: SyncItemKey) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  async function run() {
    setPending(true);
    const result = await syncAssignmentWithExercise(assignmentId, selectedParts(items, checked));
    setPending(false);
    if (result.success) {
      setOpen(false);
      toast.success(t("synced"));
      // Both forms on this screen share one `version` and a sync increments it too, so a stale
      // page would meet core-api's "edited in the meantime" on the reader's own next save.
      router.refresh();
    } else {
      toast.error(t("syncFailed"), result.formError);
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setChecked(new Set(defaultSelection(items, from)));
          setOpen(true);
        }}
        className={buttonClasses("outline", "sm", "mt-3")}
      >
        {label ?? t("sync")}
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={t("confirm.title")}
        description={t.rich("confirm.description", {
          name: exerciseName ?? t("confirm.theExercise"),
          exercise: (chunks) => (
            <a
              href={`/${locale}/exercises/${exerciseId}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {chunks}
            </a>
          ),
        })}
        confirmLabel={pending ? t("syncing") : t("confirm.action")}
        pending={pending || checked.size === 0}
        onConfirm={() => void run()}
      >
        <div className="flex flex-col gap-2">
          {warning && <p className="text-sm text-warning-foreground">{warning}</p>}

          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.key}>
                <label
                  className={`flex items-start gap-2 text-sm ${
                    item.selectable ? "" : "text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    disabled={!item.selectable}
                    checked={item.selectable && checked.has(item.key)}
                    onChange={() => toggle(item.key)}
                  />
                  <span>
                    {item.key === FILES_AND_LINKS
                      ? t("parts.filesAndLinks")
                      : t(`parts.${item.key}`)}
                    {!item.selectable && <> — {t("parts.upToDate")}</>}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {/* Shown rather than dropped: a part core-api grew after this was written is something a
              teacher should know about, and it is also the one thing this screen cannot act on. */}
          {unknown.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("confirm.unknown", { parts: unknown.join(", ") })}
            </p>
          )}

          {checked.size === 0 && (
            <p className="text-sm text-muted-foreground">{t("nothingSelected")}</p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
