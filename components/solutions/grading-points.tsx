"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { setReviewClosed } from "@/lib/actions/solution-review";
import { setSolutionPoints } from "@/lib/actions/solution-verdict";
import { isOverMax, moveExcessToBonus } from "@/lib/status/points-overflow";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * The points, beside the code they are for (X-031) -- and the only place a teacher sets them, since
 * the solution screen's verdict card went: points are awarded where the work is read.
 *
 * Whether it is graded, and whether it counts, is said above it by `GradingStatus`.
 *
 * Three independent actions, kept apart by a rule between them: save what is typed, award full
 * marks, or mark the solution as reviewed. None of them moves on; the queue above does that.
 * "Mark as reviewed" is grading too -- the automatic points stand and the teacher has read the
 * code (DEC-163).
 *
 * With a review open, the save dialog offers to close it, ticked. The points go first: their
 * notification waits a minute and reads them when it sends.
 */
export function GradingPoints({
  solutionId,
  maxPoints,
  evaluatedPoints,
  overridden,
  bonus,
  reviewStartedAt,
  reviewClosedAt,
  canSetPoints,
  canReview,
}: {
  solutionId: string;
  maxPoints: number;
  /** What the evaluation scored, shown as the points field's placeholder. */
  evaluatedPoints: number | null;
  overridden: number | null;
  bonus: number;
  reviewStartedAt: number | null;
  reviewClosedAt: number | null;
  canSetPoints: boolean;
  canReview: boolean;
}) {
  const t = useTranslations("Grading.points");
  const verdict = useTranslations("Solution.verdict");
  const review = useTranslations("Review");
  const router = useRouter();
  const toast = useToast();
  const overrideId = useId();
  const bonusId = useId();

  const [overrideInput, setOverrideInput] = useState(overridden === null ? "" : String(overridden));
  const [bonusInput, setBonusInput] = useState(String(bonus));
  const [pending, setPending] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [confirmingReviewed, setConfirmingReviewed] = useState(false);
  const [closeReview, setCloseReview] = useState(true);

  const reviewOpen = reviewStartedAt !== null && reviewClosedAt === null;
  // A review from a standing start, as the header had it; an open one is closed from the save
  // dialog instead, and a closed one has nothing left to mark.
  const canMarkReviewed = canReview && reviewStartedAt === null;

  if (!canSetPoints && !canMarkReviewed) return null;

  const typedOverride = overrideInput.trim() === "" ? null : Number(overrideInput);
  const typedBonus = bonusInput.trim() === "" ? 0 : Number(bonusInput);
  const valid = Number.isInteger(typedOverride ?? 0) && Number.isInteger(typedBonus);
  const overMax = valid && isOverMax(typedOverride, maxPoints);

  // The verdict card's read-back, word for word.
  const bonusParts = { sign: typedBonus < 0 ? "-" : "+", bonus: Math.abs(typedBonus) };
  const summary =
    typedOverride === null
      ? typedBonus === 0
        ? verdict("summary.evaluated")
        : verdict("summary.evaluatedWithBonus", bonusParts)
      : typedBonus === 0
        ? verdict("summary.points", { points: typedOverride, max: maxPoints })
        : verdict("summary.withBonus", { points: typedOverride, max: maxPoints, ...bonusParts });

  function askToSave() {
    if (pending || !canSetPoints) return;
    if (!valid) {
      toast.error(verdict("errors.invalid"));
      return;
    }
    setCloseReview(true);
    setConfirmingSave(true);
  }

  async function save() {
    setConfirmingSave(false);
    setPending(true);
    const result = await setSolutionPoints(solutionId, {
      overriddenPoints: typedOverride,
      bonusPoints: typedBonus,
    });
    if (!result.success) {
      setPending(false);
      toast.error(verdict("errors.pointsFailed"), result.formError);
      return;
    }
    if (reviewOpen && closeReview) {
      const closed = await setReviewClosed(solutionId, true);
      if (!closed.success) {
        // The points are in; only the publishing failed, and the header's own button can retry it.
        setPending(false);
        toast.error(review("errors.stateFailed"), closed.formError);
        router.refresh();
        return;
      }
    }
    setPending(false);
    toast.success(verdict("toast.pointsSaved"));
    router.refresh();
  }

  async function markReviewed() {
    setConfirmingReviewed(false);
    setPending(true);
    const result = await setReviewClosed(solutionId, true);
    setPending(false);
    if (!result.success) {
      toast.error(review("errors.stateFailed"), result.formError);
      return;
    }
    toast.success(review("toast.closed"));
    router.refresh();
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring";
  const divider = <span aria-hidden="true" className="h-7 w-px self-end bg-border" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {canSetPoints && (
          <>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                askToSave();
              }}
            >
              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={overrideId} className="font-medium">
                  {t("points", { max: maxPoints })}
                </label>
                <input
                  id={overrideId}
                  type="number"
                  step={1}
                  inputMode="numeric"
                  value={overrideInput}
                  onChange={(event) => setOverrideInput(event.target.value)}
                  placeholder={
                    evaluatedPoints === null
                      ? verdict("overridePlaceholder")
                      : t("evaluated", { points: evaluatedPoints })
                  }
                  className={`${input} w-28`}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={bonusId} className="font-medium">
                  {verdict("bonus")}
                </label>
                <input
                  id={bonusId}
                  type="number"
                  step={1}
                  inputMode="numeric"
                  value={bonusInput}
                  onChange={(event) => setBonusInput(event.target.value)}
                  className={`${input} w-24`}
                />
              </div>
              <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
                {pending ? verdict("saving") : t("save")}
              </button>
            </form>
            {divider}
            {/* One click and the save's own confirmation, read back as "10 of 10". */}
            <button
              type="button"
              disabled={pending}
              className={buttonClasses("success-subtle", "sm")}
              onClick={() => {
                setOverrideInput(String(maxPoints));
                setBonusInput("0");
                setCloseReview(true);
                setConfirmingSave(true);
              }}
            >
              {t("full", { points: maxPoints })}
            </button>
          </>
        )}
        {canMarkReviewed && (
          <>
            {canSetPoints && divider}
            <button
              type="button"
              disabled={pending}
              className={buttonClasses("outline", "sm")}
              onClick={() => setConfirmingReviewed(true)}
            >
              {review("actions.markReviewed")}
            </button>
          </>
        )}
      </div>

      {overMax && typedOverride !== null && (
        <p className="text-xs text-muted-foreground">
          {verdict.rich("overMax", {
            points: typedOverride,
            max: maxPoints,
            action: (chunks) => (
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  const next = moveExcessToBonus(typedOverride, typedBonus, maxPoints);
                  setOverrideInput(String(next.override));
                  setBonusInput(String(next.bonus));
                }}
              >
                {chunks}
              </button>
            ),
          })}
        </p>
      )}

      <ConfirmDialog
        open={confirmingSave}
        onOpenChange={setConfirmingSave}
        title={verdict("confirmSave.title")}
        description={
          typedOverride === null
            ? verdict("confirmSave.descriptionEvaluated", { summary })
            : verdict("confirmSave.description", { summary })
        }
        confirmLabel={verdict("confirmSave.confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => void save()}
      >
        {reviewOpen && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={closeReview}
              onChange={(event) => setCloseReview(event.target.checked)}
            />
            <span>{t("closeReview")}</span>
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmingReviewed}
        onOpenChange={setConfirmingReviewed}
        title={review("confirmClose.title")}
        description={review("confirmClose.description")}
        confirmLabel={review("confirmClose.confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => void markReviewed()}
      />
    </div>
  );
}
