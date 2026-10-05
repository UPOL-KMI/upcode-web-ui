"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteReview, setReviewClosed } from "@/lib/actions/solution-review";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Opening, closing and erasing a review (S-018).
 *
 * Which buttons exist follows the legacy state machine exactly, because these transitions are what
 * the student sees: **closing is what publishes the review** -- core-api counts the issues at that
 * moment, emails the author, and only then does `visibleReviewComments()` let the author read any
 * of it. "Mark as reviewed" is the same call from a standing start, for a solution a teacher has
 * read and has nothing to say about.
 *
 * Erasing is the one destructive action here, so it goes through D-006's `AlertDialog`-backed
 * confirmation; core-api refuses it unless the caller may delete every comment in the review,
 * which is why the button is offered only on `deleteReview`.
 */
export function ReviewControls({
  solutionId,
  startedAt,
  closedAt,
  canReview,
  canDeleteReview,
  hideMarkReviewed = false,
}: {
  solutionId: string;
  startedAt: number | null;
  closedAt: number | null;
  canReview: boolean;
  canDeleteReview: boolean;
  /** "Mark as reviewed" lives beside the points instead (X-031): it is a way of grading. */
  hideMarkReviewed?: boolean;
}) {
  const t = useTranslations("Review");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Closing is confirmed because it *publishes*: core-api mails the author the moment the
  // review closes, and the comments stop being the reviewer's own notes. Both buttons that
  // close -- "close" and the one-step "mark reviewed" -- go through it. Reopening does not:
  // it sends nothing and takes nothing away.
  const [confirmingClose, setConfirmingClose] = useState(false);

  if (!canReview) return null;

  async function changeState(close: boolean, successKey: string) {
    setPending(true);
    const result = await setReviewClosed(solutionId, close);
    setPending(false);
    if (result.success) {
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t("errors.stateFailed"), result.formError);
    }
  }

  async function erase() {
    setPending(true);
    const result = await deleteReview(solutionId);
    setPending(false);
    setConfirming(false);
    if (result.success) {
      toast.success(t("toast.erased"));
      router.refresh();
    } else {
      toast.error(t("errors.deleteReviewFailed"), result.formError);
    }
  }

  const secondary =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
  const primary =
    "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {startedAt === null && (
        <>
          <button
            type="button"
            disabled={pending}
            className={primary}
            onClick={() => changeState(false, "toast.opened")}
          >
            {t("actions.start")}
          </button>
          {!hideMarkReviewed && (
            <button
              type="button"
              disabled={pending}
              className={secondary}
              onClick={() => setConfirmingClose(true)}
            >
              {t("actions.markReviewed")}
            </button>
          )}
        </>
      )}
      {startedAt !== null && closedAt === null && (
        <button
          type="button"
          disabled={pending}
          className={primary}
          onClick={() => setConfirmingClose(true)}
        >
          {t("actions.close")}
        </button>
      )}
      {closedAt !== null && (
        <button
          type="button"
          disabled={pending}
          className={secondary}
          onClick={() => changeState(false, "toast.reopened")}
        >
          {t("actions.reopen")}
        </button>
      )}
      <ConfirmDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        title={t("confirmClose.title")}
        description={t("confirmClose.description")}
        confirmLabel={t("confirmClose.confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => {
          setConfirmingClose(false);
          void changeState(true, "toast.closed");
        }}
      />

      {canDeleteReview && startedAt !== null && (
        <>
          <button
            type="button"
            disabled={pending}
            className={`${secondary} text-destructive`}
            onClick={() => setConfirming(true)}
          >
            {t("actions.erase")}
          </button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t("erase.title")}
            description={t("erase.description")}
            confirmLabel={t("actions.erase")}
            pending={pending}
            onConfirm={erase}
          />
        </>
      )}
    </div>
  );
}
