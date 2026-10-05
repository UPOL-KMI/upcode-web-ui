import { getTranslations } from "next-intl/server";

import type { AttemptForStanding, Standing } from "@/lib/grading/standing";

import { Link } from "@/i18n/navigation";
import { AcceptAttempt } from "@/components/solutions/accept-attempt";
import { CheckIcon, InfoIcon, WarningIcon } from "@/components/icons";

const TONES = {
  success: "border-success bg-success-surface",
  warning: "border-warning bg-warning-surface",
  info: "border-info bg-info-surface",
} as const;

function Notice({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const Icon = tone === "success" ? CheckIcon : tone === "warning" ? WarningIcon : InfoIcon;
  return (
    <p className={`flex items-start gap-2 rounded-md border px-3 py-1.5 text-xs ${TONES[tone]}`}>
      <Icon className="mt-px size-3.5" />
      <span>{children}</span>
    </p>
  );
}

/**
 * What the points bar says about the open attempt (X-031), above the fields.
 *
 * Until a person has decided about it, the "not reviewed yet" warning. After that, whether the
 * points given here count -- green for the best or the accepted attempt. That another attempt
 * counts instead is said either way, because it is the one thing a teacher should know *before*
 * grading: points given to this attempt would change nothing. So is an attempt whose evaluation
 * failed, which never counts at all -- and offers no points either, the page leaves them out. And
 * an older attempt says there is a newer one.
 */
export async function GradingStatus({
  solutionId,
  graded,
  standing,
  latest,
  canAccept,
  grading,
}: {
  solutionId: string;
  graded: boolean;
  standing: Standing | null;
  latest: AttemptForStanding | null;
  canAccept: boolean;
  /** Links stay in grading mode when the page is in it. */
  grading: boolean;
}) {
  const t = await getTranslations("Grading");
  const href = (id: string) => `/solutions/${id}/sources${grading ? "?grade=1" : ""}`;
  const linkClass = "font-medium underline underline-offset-2 hover:decoration-2";

  function points(attempt: AttemptForStanding): string {
    const gained = attempt.gained ?? 0;
    return attempt.bonus === 0
      ? t("standing.points", { points: gained })
      : t("standing.pointsWithBonus", {
          points: gained,
          sign: attempt.bonus < 0 ? "−" : "+",
          bonus: Math.abs(attempt.bonus),
        });
  }

  let elsewhere: React.ReactNode = null;
  if (standing?.kind === "elsewhere") {
    const { counted } = standing;
    const key =
      `${counted.accepted ? "elsewhereAccepted" : "elsewhere"}${canAccept ? "" : "NoAccept"}` as const;
    elsewhere = t.rich(`standing.${key}`, {
      attempt: counted.attemptIndex,
      points: points(counted),
      link: (chunks) => (
        <Link href={href(counted.id)} className={linkClass}>
          {chunks}
        </Link>
      ),
      accept: (chunks) => <AcceptAttempt solutionId={solutionId}>{chunks}</AcceptAttempt>,
    });
  }

  let failed: React.ReactNode = null;
  if (standing?.kind === "failed") {
    const { counted } = standing;
    failed = (
      <>
        {t.rich("standing.failed", {
          rerun: (chunks) => (
            <Link href={`/solutions/${solutionId}?tab=tests#solution-rerun`} className={linkClass}>
              {chunks}
            </Link>
          ),
        })}
        {counted && (
          <>
            {" "}
            {t.rich("standing.failedCounted", {
              attempt: counted.attemptIndex,
              points: points(counted),
              link: (chunks) => (
                <Link href={href(counted.id)} className={linkClass}>
                  {chunks}
                </Link>
              ),
            })}
          </>
        )}
      </>
    );
  }

  const notices: React.ReactNode[] = [];
  if (failed) {
    // Nothing to grade here, so neither "not reviewed yet" nor a standing -- only why not.
  } else if (!graded) {
    notices.push(
      <Notice key="notGraded" tone="warning">
        {t("points.notGraded")}
      </Notice>,
    );
  } else if (standing?.kind === "best" || standing?.kind === "accepted") {
    notices.push(
      <Notice key="standing" tone="success">
        {t(`standing.${standing.kind}`)}
      </Notice>,
    );
  }
  if (failed) {
    notices.push(
      <Notice key="failed" tone="warning">
        {failed}
      </Notice>,
    );
  }
  if (elsewhere) {
    notices.push(
      <Notice key="elsewhere" tone="warning">
        {elsewhere}
      </Notice>,
    );
  }
  if (latest) {
    notices.push(
      <Notice key="latest" tone="info">
        {t.rich("standing.notLatest", {
          link: (chunks) => (
            <Link href={href(latest.id)} className={linkClass}>
              {chunks}
            </Link>
          ),
        })}
      </Notice>,
    );
  }

  return notices.length > 0 ? <div className="flex flex-col gap-1.5">{notices}</div> : null;
}
