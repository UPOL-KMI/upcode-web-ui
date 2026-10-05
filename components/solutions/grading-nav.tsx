import { getTranslations } from "next-intl/server";

import type { GradingEntry, GradingQueue } from "@/lib/grading/queue";

import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/button";

/** Where a student's entry in the queue opens: their best solution, still in grading mode. */
export function gradingHref(entry: GradingEntry): string {
  return `/solutions/${entry.solutionId}/sources?grade=1`;
}

/**
 * The way through a class, one student at a time (X-031).
 *
 * A Server Component: every link is known when the page renders, and nothing here changes until
 * the next one does. "Next" is the next row of the class table; "next ungraded" skips whoever a
 * person has already decided about and wraps round, so a second pass picks up what the first left.
 */
export async function GradingNav({
  queue,
  studentName,
  attempts,
  tableHref,
}: {
  queue: GradingQueue;
  studentName: string;
  /** "Attempt 1 (of 3)", opening the student's attempts to pick another. */
  attempts: React.ReactNode;
  /** The assignment's submissions tab, which is where a finished pass ends. */
  tableHref: string;
}) {
  const t = await getTranslations("Grading");

  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {queue.previous ? (
          <Link href={gradingHref(queue.previous)} className={buttonClasses("outline", "sm")}>
            {t("previous")}
          </Link>
        ) : (
          <span aria-disabled="true" className={buttonClasses("outline", "sm", "opacity-50")}>
            {t("previous")}
          </span>
        )}
        <span className="flex flex-col leading-tight">
          <span className="text-base font-semibold">{studentName}</span>
          <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <span>{t("position", { position: queue.position, total: queue.total })}</span>
            <span aria-hidden="true">·</span>
            {attempts}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {queue.next ? (
          <Link href={gradingHref(queue.next)} className={buttonClasses("outline", "sm")}>
            {t("next")}
          </Link>
        ) : (
          <span aria-disabled="true" className={buttonClasses("outline", "sm", "opacity-50")}>
            {t("next")}
          </span>
        )}
        {queue.nextUngraded ? (
          <Link href={gradingHref(queue.nextUngraded)} className={buttonClasses("primary", "sm")}>
            {t("nextUngraded")}
          </Link>
        ) : (
          <Link href={tableHref} className={buttonClasses("outline", "sm")}>
            {t("allGraded")}
          </Link>
        )}
      </div>
    </nav>
  );
}
