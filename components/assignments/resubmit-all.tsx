"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { resubmitAllSolutions } from "@/lib/actions/solution-rerun";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Re-running every solution of an assignment (G-002) -- what a teacher does after fixing a test,
 * a limit or a judge that graded a whole class wrongly.
 *
 * **It confirms, and it reports a job rather than a result.** core-api starts a background job and
 * answers with the pending and failed job lists; it starts nothing if a job for this assignment is
 * already pending, and answers with that same list either way. So "started" and "already running"
 * are indistinguishable in the response, and the toast says how many jobs are pending rather than
 * claiming anything finished. The rows on this screen will not have changed when it returns.
 */
export function ResubmitAll({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations("AssignmentSolutions.resubmitAll");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setPending(true);
    const result = await resubmitAllSolutions(assignmentId);
    setPending(false);
    setConfirming(false);
    if (result.success) {
      toast.success(t("toast.started", { count: result.data.pending }));
      router.refresh();
    } else {
      toast.error(t("errors.failed"), result.formError);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-disabled={pending}
        className={buttonClasses("warning-outline", "sm")}
        onClick={() => setConfirming(true)}
      >
        {t("action")}
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("confirm.title")}
        description={t("confirm.description")}
        pending={pending}
        onConfirm={() => void run()}
        confirmLabel={t("confirm.confirm")}
      />
    </>
  );
}
