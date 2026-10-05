import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { SubmitForm } from "@/components/assignments/submit-form";
import { PageShell } from "@/components/page-shell";
import { StatusState } from "@/components/state/status-state";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Submit" });
  return { title: t("title") };
}

/**
 * Submitting a solution (S-014).
 *
 * A page of its own rather than a dialog, unlike the legacy app's modal (DEC-061): an upload that
 * takes real time should not be one stray click on a backdrop away from being lost, and a real URL
 * means the back button, a reload and a shared link all behave.
 *
 * The form is only rendered when core-api says submitting is possible. That check is not a second
 * implementation of the rule -- it is the same `/can-submit` answer the assignment screen shows,
 * and the real `POST .../submit` re-checks it regardless. What it buys is a reader who is told why
 * they cannot submit instead of finding out after uploading.
 */
export default async function SubmitPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment, runtimes] = await Promise.all([
    getTranslations("Submit"),
    getAssignmentDetail(assignmentId, locale),
    // So the picker can say "Python 3" rather than `python3` -- core-api's own names, and the same
    // ones the teacher chose from on the exercise.
    getRuntimeEnvironments(),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}/submit`, locale);

  const attemptsLeft = Math.max(
    0,
    assignment.submissionsCountLimit - assignment.submission.evaluated,
  );

  return (
    <PageShell
      title={t("title")}
      subtitle={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/assignments/${assignmentId}`} className={buttonClasses("outline", "sm")}>
          <BackIcon />
          {t("back")}
        </Link>
      }
    >
      {assignment.submission.canSubmit ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            {t("intro", { attempts: attemptsLeft, files: assignment.solutionFilesLimit ?? 0 })}
          </p>
          <SubmitForm
            assignmentId={assignmentId}
            maxBytes={assignment.solutionSizeLimit ?? undefined}
            environmentNames={Object.fromEntries(
              runtimes.map((runtime) => [runtime.id, runtime.longName || runtime.name]),
            )}
          />
        </div>
      ) : (
        <StatusState
          title={t("closed.title")}
          description={
            assignment.submission.lockedReason ? t("closed.locked") : t("closed.description")
          }
          action={
            <Link href={`/assignments/${assignmentId}`} className={buttonClasses("outline", "sm")}>
              <BackIcon />
              {t("back")}
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
