"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  awardShadowPoints,
  removeShadowPoints,
  updateShadowPoints,
} from "@/lib/actions/shadow-points";
import type { ShadowPointsRecord } from "@/lib/api/shadow-assignment";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format/datetime-local";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";
import { PencilIcon } from "@/components/icons";

/**
 * Who has been awarded what, and the awarding itself (S-020).
 *
 * These are the only points in ReCodEx a person types in, so every row says **who** typed them and
 * when they say the work was done -- `awardedAt` is the teacher's own claim about when the points
 * were earned, which need not be when the record was created, and the legacy screen keeps the two
 * apart the same way.
 *
 * **The award form picks from the group's roster, and used to search every user on the instance.**
 * That was a deliberate choice -- core-api takes a user id and decides for itself, so the screen
 * did not have to answer "who belongs here" a second time -- and testing killed it: the search
 * offered people who are not in the group, awarding them failed with core-api's own
 * `User is not member of the group`, and that sentence reaches a Czech teacher in English. An
 * offer that cannot succeed is worse than a shorter list (brief §3.4).
 */
export function ShadowPointsTable({
  shadowId,
  points,
  canAward,
  students,
  maxPoints,
}: {
  shadowId: string;
  points: ShadowPointsRecord[];
  canAward: boolean;
  /** What the assignment is worth. core-api accepts more, so this only warns. */
  maxPoints: number;
  /** The group's own students -- the only people core-api will accept here. */
  students: { id: string; name: string }[];
}) {
  const t = useTranslations("Shadow.points");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [draft, setDraft] = useState({ points: "0", note: "", awardedAt: "" });
  const [awardee, setAwardee] = useState("");

  // **A warning, not a rule.** core-api stores whatever it is given -- 999 against a maximum of 10
  // is accepted and kept -- and a teacher may well mean it, as a bonus. What it must not do is
  // take a typo silently, which is what it did before.
  const entered = Number.parseInt(draft.points, 10);
  const overMax = Number.isFinite(entered) && entered > maxPoints;

  // Whoever is in the group and has no points on this assignment yet -- core-api refuses a second
  // award to the same person, which is what the old picker's `excludeIds` was for.
  const awarded = new Set(points.map((record) => record.awardeeId));
  const candidates = students.filter((student) => !awarded.has(student.id));

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (result.success) {
      setEditing(null);
      setRemoving(null);
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  function startEditing(record: ShadowPointsRecord) {
    setEditing(record.id);
    setDraft({
      points: String(record.points),
      note: record.note,
      awardedAt: record.awardedAt ? toDateTimeLocal(record.awardedAt) : "",
    });
  }

  const values = () => ({
    points: Number.parseInt(draft.points, 10) || 0,
    note: draft.note,
    awardedAt: fromDateTimeLocal(draft.awardedAt),
  });

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";
  const button =
    "rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.student")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("columns.points")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.note")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.awardedAt")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.awardedBy")}
                </th>
                {canAward && <th scope="col" className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {points.map((record) => (
                <tr key={record.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {record.awardeeName || record.awardeeId}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editing === record.id ? (
                      <input
                        type="number"
                        aria-label={t("columns.points")}
                        value={draft.points}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, points: event.target.value }))
                        }
                        className={`${input} w-20 text-right`}
                      />
                    ) : (
                      record.points
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing === record.id ? (
                      <input
                        type="text"
                        aria-label={t("columns.note")}
                        value={draft.note}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, note: event.target.value }))
                        }
                        className={`${input} w-full`}
                      />
                    ) : (
                      record.note
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {editing === record.id ? (
                      <input
                        type="datetime-local"
                        aria-label={t("columns.awardedAt")}
                        value={draft.awardedAt}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, awardedAt: event.target.value }))
                        }
                        className={input}
                      />
                    ) : record.awardedAt ? (
                      format.dateTime(new Date(record.awardedAt * 1000), DATE_TIME_FORMAT)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{record.authorName}</td>
                  {canAward && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {editing === record.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            className={button}
                            onClick={() =>
                              void run(() => updateShadowPoints(record.id, values()), "toast.saved")
                            }
                          >
                            {t("save")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className={button}
                            onClick={() => setEditing(null)}
                          >
                            {t("cancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            className={buttonClasses("warning-outline", "xs")}
                            onClick={() => startEditing(record)}
                          >
                            <PencilIcon className="size-3.5" />
                            {t("edit")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            className={button}
                            onClick={() => setRemoving(record.id)}
                          >
                            {t("remove")}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAward && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 className="text-sm font-medium">{t("award.title")}</h3>
          {/* Aligned at the top, not the bottom: one field carries a hint under it, and with
              `items-end` its height pushed that column up so the three labels no longer lined up
              with each other. */}
          <div className="flex flex-wrap items-start gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.points")}
              <input
                type="number"
                value={draft.points}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, points: event.target.value }))
                }
                className={`${input} w-24`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.note")}
              <input
                type="text"
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, note: event.target.value }))
                }
                className={input}
              />
            </label>
            {/* Left blank, core-api stores no date at all -- it defaults to nothing, and its own
                parameter is documented as "whatever that means". So the field says what it is for
                rather than leaving a teacher to guess from a label. */}
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.awardedAt")}
              <input
                type="datetime-local"
                value={draft.awardedAt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, awardedAt: event.target.value }))
                }
                className={input}
              />
              <span className="text-xs text-muted-foreground">{t("award.awardedAtHint")}</span>
            </label>
          </div>
          {overMax && (
            <p role="status" className="text-sm text-warning">
              {t("award.overMax")}
            </p>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={`${shadowId}-awardee`}>{t("award.who")}</label>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("award.noCandidates")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id={`${shadowId}-awardee`}
                  className={`${input} w-72`}
                  value={awardee}
                  onChange={(event) => setAwardee(event.target.value)}
                >
                  <option value="">{t("award.choose")}</option>
                  {candidates.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name || student.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || awardee === ""}
                  onClick={() =>
                    void run(() => awardShadowPoints(shadowId, awardee, values()), "toast.awarded")
                  }
                  className={buttonClasses("outline", "xs")}
                >
                  {t("award.button")}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("confirmRemove.title")}
        description={t("confirmRemove.description")}
        pending={pending}
        onConfirm={() => {
          if (removing) void run(() => removeShadowPoints(removing), "toast.removed");
        }}
      />
    </div>
  );
}
