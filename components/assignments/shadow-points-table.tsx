"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  awardShadowPoints,
  awardShadowPointsMany,
  removeShadowPoints,
  updateShadowPoints,
} from "@/lib/actions/shadow-points";
import type { ShadowPointsRecord } from "@/lib/api/shadow-assignment";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format/datetime-local";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import { isOverMax } from "@/lib/status/points-overflow";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { Button } from "@/components/button";
import { CheckIcon, CloseIcon, PencilIcon, TrashIcon } from "@/components/icons";

/**
 * Every student of the group against this shadow assignment (S-020, reworked in X-032 / DEC-166).
 *
 * **One row per student, graded or not.** The first version listed only the records and awarded
 * through a separate form with a "who" picker, so "who still has nothing" was a question the
 * screen made the teacher answer by comparing two lists. Now an ungraded row says so and is edited
 * in place like any other; saving it creates the record, saving a graded one updates it -- core-api
 * keeps exactly one record per student and assignment, so the row and the record are one thing.
 *
 * The quick buttons (full marks, zero) only **prefill** the row: points typed by a person are the
 * only points in ReCodEx nobody computes, so nothing is written until the teacher saves it. The
 * collective award is the legacy screen's: tick the ungraded, give them all the same.
 *
 * These are the only points a person types in, so every row says **who** typed them and when they
 * say the work was done -- `awardedAt` is the teacher's own claim about when the points were
 * earned, which need not be when the record was created. A new record starts at "now", as legacy.
 */
interface Row {
  studentId: string;
  name: string;
  record: ShadowPointsRecord | null;
}

interface Draft {
  points: string;
  note: string;
  awardedAt: string;
}

const nowLocal = () => toDateTimeLocal(Math.floor(Date.now() / 1000));

function parsePoints(value: string): number | null {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isInteger(parsed) ? parsed : null;
}

export function ShadowPointsTable({
  shadowId,
  points,
  students,
  maxPoints,
  can,
}: {
  shadowId: string;
  points: ShadowPointsRecord[];
  /** The group's own students -- the only people core-api will accept here. */
  students: { id: string; name: string }[];
  /** What the assignment is worth. core-api accepts more, so this only warns. */
  maxPoints: number;
  can: { create: boolean; update: boolean; remove: boolean };
}) {
  const t = useTranslations("Shadow.points");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ShadowPointsRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Draft>({ points: "", note: "", awardedAt: "" });

  // A student who has left the group keeps their record, so they keep their row.
  const byStudent = new Map(points.map((record) => [record.awardeeId ?? record.id, record]));
  const rows: Row[] = [
    ...students.map((student) => ({
      studentId: student.id,
      name: student.name,
      record: byStudent.get(student.id) ?? null,
    })),
    ...points
      .filter((record) => !students.some((student) => student.id === record.awardeeId))
      .map((record) => ({
        studentId: record.awardeeId ?? record.id,
        name: record.awardeeName,
        record,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const ungraded = rows.filter((row) => row.record === null).map((row) => row.studentId);
  const showActions = can.create || can.update || can.remove;

  function open(row: Row, prefill?: number) {
    setDrafts((current) => ({
      ...current,
      [row.studentId]: {
        points: String(prefill ?? row.record?.points ?? ""),
        note: row.record?.note ?? "",
        awardedAt: row.record
          ? row.record.awardedAt !== null
            ? toDateTimeLocal(row.record.awardedAt)
            : ""
          : nowLocal(),
      },
    }));
  }

  function close(studentId: string) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
  }

  function change(studentId: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId]!, [field]: value },
    }));
  }

  const valuesOf = (draft: Draft, points: number) => ({
    points,
    note: draft.note,
    awardedAt: fromDateTimeLocal(draft.awardedAt),
  });

  async function save(row: Row) {
    const draft = drafts[row.studentId];
    const entered = draft ? parsePoints(draft.points) : null;
    if (!draft || entered === null) return;
    setPending(row.studentId);
    const result = row.record
      ? await updateShadowPoints(row.record.id, valuesOf(draft, entered))
      : await awardShadowPoints(shadowId, row.studentId, valuesOf(draft, entered));
    setPending(null);
    if (result.success) {
      close(row.studentId);
      toast.success(t(row.record ? "toast.saved" : "toast.awarded"));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  async function remove(record: ShadowPointsRecord) {
    setPending(record.id);
    const result = await removeShadowPoints(record.id);
    setPending(null);
    if (result.success) {
      setRemoving(null);
      toast.success(t("toast.removed"));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  function toggle(studentIds: string[], on: boolean) {
    if (on && selected.size === 0 && bulk.awardedAt === "") {
      setBulk((current) => ({ ...current, awardedAt: nowLocal() }));
    }
    setSelected((current) => {
      const next = new Set(current);
      for (const id of studentIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function awardSelected() {
    const entered = parsePoints(bulk.points);
    if (entered === null || selected.size === 0) return;
    setPending("bulk");
    const result = await awardShadowPointsMany(shadowId, [...selected], valuesOf(bulk, entered));
    setPending(null);
    if (!result.success) {
      toast.error(t("failed"), result.formError);
      return;
    }
    const { awarded, failed } = result.data;
    if (awarded.length > 0) toast.success(t("toast.bulk", { count: awarded.length }));
    if (failed.length > 0) {
      const names = failed.map((id) => rows.find((row) => row.studentId === id)?.name ?? id);
      toast.error(t("failed"), t("bulkFailed", { names: names.join(", ") }));
    }
    setSelected(new Set(failed));
    if (failed.length === 0) setBulk({ points: "", note: "", awardedAt: "" });
    router.refresh();
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";
  const bulkPoints = parsePoints(bulk.points);
  const allSelected = ungraded.length > 0 && ungraded.every((id) => selected.has(id));

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-3">
      {can.create && selected.size > 0 && (
        <section
          aria-label={t("bulk.button")}
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
        >
          <div className="flex flex-wrap items-end gap-2">
            <p className="mr-2 self-center text-sm font-medium">
              {t("bulk.selected", { count: selected.size })}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.points")}
              <input
                type="number"
                value={bulk.points}
                onChange={(event) => setBulk({ ...bulk, points: event.target.value })}
                className={`${input} w-24`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.note")}
              <input
                type="text"
                value={bulk.note}
                onChange={(event) => setBulk({ ...bulk, note: event.target.value })}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("columns.awardedAt")}
              <input
                type="datetime-local"
                value={bulk.awardedAt}
                onChange={(event) => setBulk({ ...bulk, awardedAt: event.target.value })}
                className={input}
              />
            </label>
            <Button
              variant="primary"
              disabled={pending !== null || bulkPoints === null}
              onClick={() => void awardSelected()}
            >
              <CheckIcon />
              {t("bulk.button")}
            </Button>
            <Button disabled={pending !== null} onClick={() => setSelected(new Set())}>
              <CloseIcon />
              {t("bulk.clear")}
            </Button>
          </div>
          {isOverMax(bulkPoints, maxPoints) && (
            <p role="status" className="text-sm text-warning">
              {t("overMax")}
            </p>
          )}
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {can.create && (
                <th scope="col" className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={t("bulk.selectAll")}
                    disabled={ungraded.length === 0}
                    checked={allSelected}
                    onChange={(event) => toggle(ungraded, event.target.checked)}
                  />
                </th>
              )}
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
              {showActions && (
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const draft = drafts[row.studentId];
              const entered = draft ? parsePoints(draft.points) : null;
              const busy = pending === row.studentId || pending === row.record?.id;
              return (
                <tr key={row.studentId} className="border-t border-border align-top">
                  {can.create && (
                    <td className="px-3 py-2">
                      {row.record === null && (
                        <input
                          type="checkbox"
                          aria-label={t("bulk.select", { name: row.name })}
                          checked={selected.has(row.studentId)}
                          onChange={(event) => toggle([row.studentId], event.target.checked)}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium">{row.name || row.studentId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {draft ? (
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          aria-label={t("columns.points")}
                          value={draft.points}
                          onChange={(event) => change(row.studentId, "points", event.target.value)}
                          className={`${input} w-20 text-right`}
                        />
                        {isOverMax(entered, maxPoints) && (
                          <span role="status" className="max-w-48 text-xs text-warning">
                            {t("overMax")}
                          </span>
                        )}
                      </div>
                    ) : row.record ? (
                      row.record.points
                    ) : (
                      <span className="text-muted-foreground">{t("notGraded")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {draft ? (
                      <input
                        type="text"
                        aria-label={t("columns.note")}
                        value={draft.note}
                        onChange={(event) => change(row.studentId, "note", event.target.value)}
                        className={`${input} w-full`}
                      />
                    ) : (
                      row.record?.note
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {draft ? (
                      <input
                        type="datetime-local"
                        aria-label={t("columns.awardedAt")}
                        value={draft.awardedAt}
                        onChange={(event) => change(row.studentId, "awardedAt", event.target.value)}
                        className={input}
                      />
                    ) : row.record?.awardedAt ? (
                      format.dateTime(new Date(row.record.awardedAt * 1000), DATE_TIME_FORMAT)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.record?.authorName}</td>
                  {showActions && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-2">
                        {draft ? (
                          <>
                            <Button
                              variant="primary"
                              size="xs"
                              disabled={busy || entered === null}
                              onClick={() => void save(row)}
                            >
                              <CheckIcon className="size-3.5" />
                              {t("save")}
                            </Button>
                            <Button size="xs" disabled={busy} onClick={() => close(row.studentId)}>
                              <CloseIcon className="size-3.5" />
                              {t("cancel")}
                            </Button>
                          </>
                        ) : (
                          <>
                            {(row.record ? can.update : can.create) && (
                              <Button
                                variant="warning-outline"
                                size="xs"
                                disabled={busy}
                                onClick={() => open(row)}
                              >
                                <PencilIcon className="size-3.5" />
                                {t("edit")}
                              </Button>
                            )}
                            {row.record === null && can.create && (
                              <>
                                <Button
                                  variant="success-subtle"
                                  size="xs"
                                  aria-label={t("quick.label", { points: maxPoints })}
                                  onClick={() => open(row, maxPoints)}
                                >
                                  {maxPoints}
                                </Button>
                                <Button
                                  variant="destructive-subtle"
                                  size="xs"
                                  aria-label={t("quick.label", { points: 0 })}
                                  onClick={() => open(row, 0)}
                                >
                                  0
                                </Button>
                              </>
                            )}
                            {row.record && can.remove && (
                              <Button
                                variant="destructive-outline"
                                size="xs"
                                disabled={busy}
                                onClick={() => setRemoving(row.record)}
                              >
                                <TrashIcon className="size-3.5" />
                                {t("remove")}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("confirmRemove.title")}
        description={t("confirmRemove.description")}
        pending={pending !== null}
        onConfirm={() => {
          if (removing) void remove(removing);
        }}
      />
    </div>
  );
}
