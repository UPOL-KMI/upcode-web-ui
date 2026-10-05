"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { setSolutionAccepted } from "@/lib/actions/solution-verdict";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * "Accept the solution", a link inside the grading bar's warning that another attempt counts
 * (X-031). It opens a dialog saying what accepting does before it does it: the solution then counts
 * whatever the other attempts score, and the flag moves here from any attempt that had it.
 *
 * There is no way back from here on purpose: to count a different attempt, a teacher opens that one
 * and accepts it, so an accepted solution is never left without one that counts in its place.
 */
export function AcceptAttempt({
  solutionId,
  children,
}: {
  solutionId: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Grading.accept");
  const verdict = useTranslations("Solution.verdict");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function accept() {
    setConfirming(false);
    setPending(true);
    const result = await setSolutionAccepted(solutionId, true);
    setPending(false);
    if (!result.success) {
      toast.error(verdict("errors.acceptFailed"), result.formError);
      return;
    }
    toast.success(verdict("toast.accepted"));
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="font-medium underline underline-offset-2 hover:decoration-2"
        onClick={() => setConfirming(true)}
      >
        {children}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("title")}
        description={t("description")}
        confirmLabel={t("confirm")}
        destructive={false}
        pending={pending}
        onConfirm={() => void accept()}
      />
    </>
  );
}
