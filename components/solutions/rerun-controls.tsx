"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteSolution, resubmitSolution } from "@/lib/actions/solution-rerun";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Running a solution again, and removing it (G-002).
 *
 * **A resubmit lands where a fresh submission lands.** core-api answers it with a submit's own
 * payload, monitor channel included, and that id is disclosed once and never again -- so this
 * navigates to the same `?monitor=&tasks=` URL the submit form produces (S-016) rather than merely
 * refreshing. Refreshing would work and would silently throw away the only chance to watch the job.
 *
 * Debug mode is a second button rather than a checkbox: it is not a variation on the ordinary
 * re-run, it is what a teacher reaches for when the ordinary result did not explain itself, and a
 * checkbox left ticked from last time is a surprise.
 *
 * Deleting is the one irreversible action here and it takes everything -- the review and its
 * comments, every submission's archives, the source. Its confirmation says so, because core-api
 * will not ask.
 *
 * **On a data-only exercise this is only the delete button** (X-026). Nothing is run for such a
 * submission, so "run it again" is an offer to repeat nothing and the prose beside it -- fix a
 * test, a limit, a judge -- describes machinery the exercise does not have. core-api would accept
 * the resubmit; that is not a reason to offer it. The delete button stays, because it is the one
 * thing a teacher does need here, and the heading and explanation change to say what is left.
 */
export function RerunControls({
  solutionId,
  assignmentId,
  canResubmit,
  canDelete,
  dataOnly = false,
}: {
  solutionId: string;
  assignmentId: string;
  canResubmit: boolean;
  canDelete: boolean;
  dataOnly?: boolean;
}) {
  const t = useTranslations("Solution.rerun");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Which re-run is waiting to be confirmed, or null. One piece of state rather than two booleans:
  // the two dialogs are the same dialog with different words, and two flags could both be true.
  const [confirmingRerun, setConfirmingRerun] = useState<"plain" | "debug" | null>(null);

  const offerRerun = canResubmit && !dataOnly;
  if (!offerRerun && !canDelete) return null;

  async function rerun(debug: boolean) {
    setConfirmingRerun(null);
    setPending(true);
    const result = await resubmitSolution(solutionId, debug);
    setPending(false);
    if (!result.success) {
      // core-api's own message is the useful one: it says *why*, and the commonest why is that the
      // solution's environment is no longer enabled on the assignment.
      toast.error(t("errors.resubmitFailed"), result.formError);
      return;
    }
    toast.success(t("toast.resubmitted"));
    const { monitorChannelId, expectedTasks } = result.data;
    router.push(
      monitorChannelId === null
        ? `/solutions/${solutionId}`
        : `/solutions/${solutionId}?monitor=${encodeURIComponent(monitorChannelId)}&tasks=${expectedTasks}`,
    );
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const result = await deleteSolution(solutionId);
    setPending(false);
    setConfirmingDelete(false);
    if (result.success) {
      toast.success(t("toast.deleted"));
      router.push(`/assignments/${assignmentId}/solutions`);
    } else {
      toast.error(t("errors.deleteFailed"), result.formError);
    }
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60";

  return (
    <section aria-labelledby="solution-rerun" className="flex flex-col gap-3">
      <h2 id="solution-rerun" className="text-base font-semibold tracking-tight">
        {t(dataOnly ? "dataOnlyTitle" : "title")}
      </h2>
      {/* No sentence under the data-only heading: *Smazání řešení* over a button reading *Smazat
          toto řešení* says the whole thing, and explaining why there is nothing to re-run answers
          a question the screen no longer raises. The operator's call. */}
      {!dataOnly && <p className="text-sm text-muted-foreground">{t("explain")}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {offerRerun && (
          <>
            <button
              type="button"
              aria-disabled={pending}
              className={button}
              onClick={() => setConfirmingRerun("plain")}
            >
              {t("resubmit")}
            </button>
            <button
              type="button"
              aria-disabled={pending}
              className={button}
              onClick={() => setConfirmingRerun("debug")}
            >
              {t("resubmitDebug")}
            </button>
          </>
        )}
        {canDelete && (
          <button
            type="button"
            aria-disabled={pending}
            className={buttonClasses("destructive-outline", "sm")}
            onClick={() => setConfirmingDelete(true)}
          >
            {t("delete")}
          </button>
        )}
      </div>

      {/* Confirmed although nothing is destroyed: a re-run occupies a worker for as long as the
          solution takes, and a mis-click on a row of three buttons costs the machine time of a
          whole evaluation. Asked for by the operator. `destructive={false}` -- the confirm button
          is not painted red, because this takes nothing away. */}
      <ConfirmDialog
        open={confirmingRerun !== null}
        onOpenChange={(open) => !open && setConfirmingRerun(null)}
        title={t(
          confirmingRerun === "debug" ? "confirmResubmitDebug.title" : "confirmResubmit.title",
        )}
        description={t(
          confirmingRerun === "debug"
            ? "confirmResubmitDebug.description"
            : "confirmResubmit.description",
        )}
        confirmLabel={t(
          confirmingRerun === "debug" ? "confirmResubmitDebug.confirm" : "confirmResubmit.confirm",
        )}
        destructive={false}
        pending={pending}
        onConfirm={() => void rerun(confirmingRerun === "debug")}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(false)}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        pending={pending}
        onConfirm={() => void remove()}
        confirmLabel={t("confirmDelete.confirm")}
      />
    </section>
  );
}
