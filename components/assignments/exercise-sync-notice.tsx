import { getLocale, getTranslations } from "next-intl/server";

import type { AssignmentDetail } from "@/lib/api/assignment";
import { isSyncPart } from "@/lib/assignments/sync-parts";
import { getExerciseName } from "@/lib/api/exercise-detail";

import { SyncWithExercise } from "./sync-with-exercise";

/**
 * What a teacher needs to know about where this assignment came from (S-013).
 *
 * An assignment is a **snapshot** of an exercise, not a live view of one: editing the exercise
 * afterwards leaves every assignment made from it on the old copy, and core-api reports which
 * parts have drifted in `exerciseSynchronizationInfo`. Reading that is what turns "the tests I
 * fixed yesterday are not running" into a visible state. The button that acts on it arrived with
 * the rest of the edits (T-002), and is offered only where core-api says a re-sync is possible --
 * a drifted assignment whose exercise has since been deleted has nothing to sync *from*.
 *
 * The deleted-exercise case is the same field saying something else: `exerciseId` is null, no
 * further synchronisation is possible, and no new assignment can be made from it.
 */
export async function ExerciseSyncNotice({ assignment }: { assignment: AssignmentDetail }) {
  const [t, locale] = await Promise.all([getTranslations("Assignment.sync"), getLocale()]);
  if (!assignment.can.update) return null;

  if (assignment.exerciseId === null) {
    return (
      <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
        <p className="font-medium">{t("deleted.title")}</p>
        <p className="mt-1 text-muted-foreground">{t("deleted.description")}</p>
      </div>
    );
  }

  if (assignment.staleParts.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
      <p className="font-medium">{t("stale.title")}</p>
      <p className="mt-1 text-muted-foreground">
        {t("stale.description", { parts: assignment.staleParts.length })}
      </p>
      <ul className="mt-2 list-inside list-disc text-muted-foreground">
        {assignment.staleParts.map((part) => (
          <li key={part}>{isSyncPart(part) ? t(`parts.${part}`) : part}</li>
        ))}
      </ul>
      {assignment.syncPossible && (
        <SyncWithExercise
          assignmentId={assignment.id}
          exerciseId={assignment.exerciseId}
          exerciseName={await getExerciseName(assignment.exerciseId, locale)}
          stale={assignment.staleParts}
          from="drift"
        />
      )}
    </div>
  );
}
