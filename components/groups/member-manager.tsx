"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  addGroupStudent,
  removeGroupMember,
  removeGroupStudent,
  setGroupMember,
} from "@/lib/actions/group-settings";
import type { GroupMember } from "@/lib/api/group-detail";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { UserPicker } from "@/components/groups/user-picker";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Who belongs to the group, and in what capacity (S-009).
 *
 * The legacy app splits this in two -- supervisors and admins on the group's info page, students
 * on the students page -- and `docs/IA.md` §4.2 puts both here, under Settings, because they are
 * the same question asked about two kinds of person. The two calls behind them are genuinely
 * different (`students/{userId}` and `members/{userId}` are separate endpoints with separate
 * permissions), which is why the two lists stay visibly separate rather than merging into one
 * table with a role column that would silently mean two things.
 *
 * Changing someone's role is one call: core-api's `addMember` overwrites whatever membership the
 * user held, so promoting a supervisor to admin needs no removal first.
 */
const ROLES = ["admin", "supervisor", "observer"] as const;

export function MemberManager({
  groupId,
  members,
  students,
  canEditMembers,
  canEditStudents,
}: {
  groupId: string;
  members: GroupMember[];
  students: { id: string; fullName: string }[];
  canEditMembers: boolean;
  canEditStudents: boolean;
}) {
  const t = useTranslations("Group.settings.members");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  // **Removing somebody is a click that cannot be taken back from this screen**, and it used to be
  // one click next to their name. Reported by the operator, who is right about the shape of the
  // mistake: the button sits in a list, and a list is where a mis-click lands on the wrong row.
  const [removing, setRemoving] = useState<{
    kind: "student" | "member";
    id: string;
    name: string;
  } | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (result.success) {
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  const rowButton =
    "rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t("staff.title")}</h3>
        {/* Where the operator first went looking for it: the role that lets a teacher open a
            subgroup is an instance role set on the person, not a membership set here. */}
        <p className="text-xs text-muted-foreground">{t("staff.explain")}</p>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("staff.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{member.fullName || member.id}</span>
                {/* **An inherited administrator is not editable here.** They administer this group
                    because they administer something above it, and core-api's own membership lookup
                    skips inherited rows -- so changing the role would silently mint a second,
                    direct membership shadowing the first, and removing would do nothing at all.
                    Both are offers that cannot succeed, so neither is made; the row says where the
                    role actually comes from instead. */}
                {member.inherited ? (
                  <>
                    <span className="text-muted-foreground">{t(`staff.roles.${member.role}`)}</span>
                    <Badge tone="neutral">{t("staff.inherited")}</Badge>
                  </>
                ) : canEditMembers ? (
                  <>
                    <select
                      aria-label={t("staff.role", { name: member.fullName })}
                      value={member.role}
                      disabled={pending}
                      onChange={(event) =>
                        void run(
                          () =>
                            setGroupMember(
                              groupId,
                              member.id,
                              event.target.value as (typeof ROLES)[number],
                            ),
                          "staff.roleChanged",
                        )
                      }
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`staff.roles.${role}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={t("staff.removeMember", { name: member.fullName })}
                      disabled={pending}
                      className={rowButton}
                      onClick={() =>
                        setRemoving({
                          kind: "member",
                          id: member.id,
                          name: member.fullName || member.id,
                        })
                      }
                    >
                      {t("remove")}
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t(`staff.roles.${member.role}`)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditMembers && (
          <UserPicker
            label={t("staff.add")}
            actionLabel={t("staff.addAsSupervisor")}
            pending={pending}
            excludeIds={members.map((member) => member.id)}
            onPick={(userId) =>
              void run(() => setGroupMember(groupId, userId, "supervisor"), "staff.added")
            }
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">
          {t("students.title")}{" "}
          <span className="text-muted-foreground tabular-nums">({students.length})</span>
        </h3>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("students.empty")}</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {students.map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{student.fullName || student.id}</span>
                {canEditStudents && (
                  <button
                    type="button"
                    aria-label={t("students.removeStudent", { name: student.fullName })}
                    disabled={pending}
                    className={rowButton}
                    onClick={() =>
                      setRemoving({
                        kind: "student",
                        id: student.id,
                        name: student.fullName || student.id,
                      })
                    }
                  >
                    {t("remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditStudents && (
          <UserPicker
            label={t("students.add")}
            actionLabel={t("students.addButton")}
            pending={pending}
            excludeIds={students.map((student) => student.id)}
            onPick={(userId) => void run(() => addGroupStudent(groupId, userId), "students.added")}
          />
        )}
      </section>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={t(`confirmRemove.${removing?.kind ?? "student"}.title`)}
        description={t(`confirmRemove.${removing?.kind ?? "student"}.description`, {
          name: removing?.name ?? "",
        })}
        confirmLabel={t("confirmRemove.confirm")}
        pending={pending}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (!target) return;
          void run(
            () =>
              target.kind === "student"
                ? removeGroupStudent(groupId, target.id)
                : removeGroupMember(groupId, target.id),
            target.kind === "student" ? "students.removed" : "staff.removed",
          );
        }}
      />
    </div>
  );
}
