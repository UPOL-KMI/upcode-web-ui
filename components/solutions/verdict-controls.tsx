"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { setSolutionAccepted, setSolutionPoints } from "@/lib/actions/solution-verdict";
import { isOverMax, moveExcessToBonus as splitOverflow } from "@/lib/status/points-overflow";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * What a teacher decides about a solution that the pipeline did not (G-001): which attempt counts,
 * and what it is worth.
 *
 * **Three shortcuts and a form, which is the legacy screen's own shape.** Zeroing a solution,
 * awarding it full marks and clearing an override are the three things a teacher does most, and
 * each is one click; the form underneath is for the number in between. The shortcuts are not
 * separate endpoints -- all four submit the same `bonus-points` call -- but a teacher correcting a
 * broken test on twenty submissions should not type "0" twenty times.
 *
 * **Accepting is a move, not an addition**, so it confirms: core-api treats `accepted` as unique
 * per author per assignment and clears it from the author's other attempts. The dialog says that in
 * words, because the button does not look like it takes something away from another screen.
 *
 * Rendered only where core-api says so: `setFlag` and `setBonusPoints` are separate grants and the
 * two halves appear independently.
 */
export function VerdictControls({
  solutionId,
  accepted,
  overridden,
  bonus,
  maxPoints,
  canAccept,
  canSetPoints,
}: {
  solutionId: string;
  accepted: boolean;
  overridden: number | null;
  bonus: number;
  maxPoints: number;
  canAccept: boolean;
  canSetPoints: boolean;
}) {
  const t = useTranslations("Solution.verdict");
  const router = useRouter();
  const toast = useToast();
  const overrideId = useId();
  const bonusId = useId();

  const [pending, setPending] = useState(false);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  // Which one-click award is waiting to be confirmed, or null. The two buttons overwrite whatever
  // the evaluation worked out and write to the student, so neither is a mis-click worth having.
  const [confirmingQuick, setConfirmingQuick] = useState<"zero" | "full" | null>(null);
  const [confirmingSave, setConfirmingSave] = useState(false);

  const [overrideInput, setOverrideInput] = useState(overridden === null ? "" : String(overridden));
  const [bonusInput, setBonusInput] = useState(String(bonus));

  // Each quick award is refused when the solution already carries exactly what it would write --
  // the same no-op test the "clear" button beside them has always used. Not "the student has zero
  // points": an evaluation that scored nought with no override is a different state, and pinning
  // the override there is a real change (a re-run would no longer move it). Asked for by the
  // operator, who found both buttons live on a solution they could not alter.
  const isZeroed = overridden === 0 && bonus === 0;
  const isFull = overridden === maxPoints && bonus === 0;

  // What the manual form would send, read straight off the two fields. Empty override means "let
  // the evaluation decide", which is not the same as zero and is why this is `null` rather than 0.
  const typedOverride = overrideInput.trim() === "" ? null : Number(overrideInput);
  const typedBonus = bonusInput.trim() === "" ? 0 : Number(bonusInput);
  const manualValid = Number.isInteger(typedOverride ?? 0) && Number.isInteger(typedBonus);
  // Above the assignment's maximum -- rule and arithmetic both in `points-overflow`, where they
  // are unit-tested.
  const overMax = manualValid && isOverMax(typedOverride, maxPoints);

  /**
   * What the dialog reads back, and **which dialog it is**.
   *
   * An empty points field is not a value being set, it is the evaluation being handed the decision
   * back -- the save sends `overriddenPoints: null`. The confirmation therefore cannot be the one
   * that says "what you set here replaces what the evaluation worked out": that sentence directly
   * contradicts the summary beside it, which is what the operator read. It gets its own wording.
   *
   * The bonus is saved either way, so it has to be read back either way: leaving the points empty
   * and typing a bonus used to be summarised as "whatever the evaluation worked out" with the
   * bonus not mentioned at all, and then saved.
   */
  const evaluationDecides = typedOverride === null;
  // The sign travels separately from the number so that a negative bonus -- which the form invites,
  // and says so -- reads as "- 3 (bonus)" rather than "+ -3 (bonus)".
  const bonusParts = { sign: typedBonus < 0 ? "-" : "+", bonus: Math.abs(typedBonus) };
  const manualSummary = evaluationDecides
    ? typedBonus === 0
      ? t("summary.evaluated")
      : t("summary.evaluatedWithBonus", bonusParts)
    : typedBonus === 0
      ? t("summary.points", { points: typedOverride, max: maxPoints })
      : t("summary.withBonus", { points: typedOverride, max: maxPoints, ...bonusParts });

  function moveExcessToBonus() {
    if (typedOverride === null) return;
    const next = splitOverflow(typedOverride, typedBonus, maxPoints);
    setOverrideInput(String(next.override));
    setBonusInput(String(next.bonus));
  }

  if (!canAccept && !canSetPoints) return null;

  async function submitPoints(next: { overriddenPoints: number | null; bonusPoints: number }) {
    setConfirmingQuick(null);
    setPending(true);
    const result = await setSolutionPoints(solutionId, next);
    setPending(false);
    if (result.success) {
      setOverrideInput(next.overriddenPoints === null ? "" : String(next.overriddenPoints));
      setBonusInput(String(next.bonusPoints));
      toast.success(t("toast.pointsSaved"));
      router.refresh();
    } else {
      toast.error(t("errors.pointsFailed"), result.formError);
    }
  }

  async function accept(value: boolean) {
    setPending(true);
    const result = await setSolutionAccepted(solutionId, value);
    setPending(false);
    setConfirmingAccept(false);
    if (result.success) {
      toast.success(value ? t("toast.accepted") : t("toast.unaccepted"));
      router.refresh();
    } else {
      toast.error(t("errors.acceptFailed"), result.formError);
    }
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60";
  const input =
    "w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <section aria-labelledby="solution-verdict" className="flex flex-col gap-3">
      <h2 id="solution-verdict" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {canAccept && (
          <div className="flex flex-wrap items-center gap-3 p-4">
            <button
              type="button"
              aria-disabled={pending}
              className={button}
              onClick={() => (accepted ? void accept(false) : setConfirmingAccept(true))}
            >
              {accepted ? t("unaccept") : t("accept")}
            </button>
            <span className="text-xs text-muted-foreground">
              {accepted ? t("acceptedNote") : t("acceptNote")}
            </span>
          </div>
        )}

        {canSetPoints && (
          <>
            <div className="flex flex-col gap-2 p-4">
              <h3 className="text-sm font-medium">{t("quickTitle")}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-disabled={pending || isZeroed}
                  className={buttonClasses("destructive-subtle", "sm")}
                  onClick={() => {
                    if (pending || isZeroed) return;
                    setConfirmingQuick("zero");
                  }}
                >
                  {t("zero")}
                </button>
                <button
                  type="button"
                  aria-disabled={pending || isFull}
                  className={buttonClasses("success-subtle", "sm")}
                  onClick={() => {
                    if (pending || isFull) return;
                    setConfirmingQuick("full");
                  }}
                >
                  {t("full", { points: maxPoints })}
                </button>
                <button
                  type="button"
                  aria-disabled={pending || (overridden === null && bonus === 0)}
                  className={buttonClasses("ghost", "sm")}
                  onClick={() => void submitPoints({ overriddenPoints: null, bonusPoints: 0 })}
                >
                  {t("clear")}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-4">
              <h3 className="text-sm font-medium">{t("manualTitle")}</h3>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending) return;
                  // A dialog reading back "NaN of 20" would be worse than the action's own
                  // refusal, so anything that is not a pair of whole numbers goes straight to it.
                  if (!manualValid) {
                    void submitPoints({
                      overriddenPoints: typedOverride,
                      bonusPoints: typedBonus,
                    });
                    return;
                  }
                  setConfirmingSave(true);
                }}
              >
                <div className="flex flex-col gap-1 text-sm">
                  <label htmlFor={overrideId} className="font-medium">
                    {t("override")}
                  </label>
                  <input
                    id={overrideId}
                    type="number"
                    step={1}
                    inputMode="numeric"
                    value={overrideInput}
                    onChange={(event) => setOverrideInput(event.target.value)}
                    placeholder={t("overridePlaceholder")}
                    className={input}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <label htmlFor={bonusId} className="font-medium">
                    {t("bonus")}
                  </label>
                  <input
                    id={bonusId}
                    type="number"
                    step={1}
                    inputMode="numeric"
                    value={bonusInput}
                    onChange={(event) => setBonusInput(event.target.value)}
                    className={input}
                  />
                </div>
                <button
                  type="submit"
                  aria-disabled={pending}
                  className={buttonClasses("primary", "sm")}
                >
                  {pending ? t("saving") : t("save")}
                </button>
              </form>
              {overMax && (
                <p className="text-xs text-warning">
                  {t.rich("overMax", {
                    // `overMax` already proved it is a number; the fallback is for the compiler.
                    points: typedOverride ?? 0,
                    max: maxPoints,
                    action: (chunks) => (
                      <button
                        type="button"
                        onClick={moveExcessToBonus}
                        className="underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {chunks}
                      </button>
                    ),
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t("overrideNote")}</p>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmingAccept}
        onOpenChange={(open) => !open && setConfirmingAccept(false)}
        title={t("confirmAccept.title")}
        description={t("confirmAccept.description")}
        pending={pending}
        onConfirm={() => void accept(true)}
        confirmLabel={t("confirmAccept.confirm")}
      />

      {/* One dialog for both quick awards: they are the same question about a different number.
          `destructive` follows the button that opened it -- awarding full marks is not a loss. */}
      <ConfirmDialog
        open={confirmingQuick !== null}
        onOpenChange={(open) => !open && setConfirmingQuick(null)}
        title={t(confirmingQuick === "full" ? "confirmFull.title" : "confirmZero.title")}
        description={
          confirmingQuick === "full"
            ? t("confirmFull.description", { points: maxPoints })
            : t("confirmZero.description")
        }
        confirmLabel={t(confirmingQuick === "full" ? "confirmFull.confirm" : "confirmZero.confirm")}
        destructive={confirmingQuick !== "full"}
        pending={pending}
        onConfirm={() =>
          void submitPoints({
            overriddenPoints: confirmingQuick === "full" ? maxPoints : 0,
            bonusPoints: 0,
          })
        }
      />

      {/* Saving is confirmed for the same reason the one-click awards are: it overwrites the
          evaluation and writes to the student. The dialog reads back the numbers rather than
          asking "are you sure" -- a mis-typed digit is exactly what this is meant to catch. */}
      <ConfirmDialog
        open={confirmingSave}
        onOpenChange={(open) => !open && setConfirmingSave(false)}
        title={t("confirmSave.title")}
        description={t(
          evaluationDecides ? "confirmSave.descriptionEvaluated" : "confirmSave.description",
          { summary: manualSummary },
        )}
        confirmLabel={t("confirmSave.confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => {
          setConfirmingSave(false);
          void submitPoints({ overriddenPoints: typedOverride, bonusPoints: typedBonus });
        }}
      />
    </section>
  );
}
