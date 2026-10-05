"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  createGroupInvitation,
  deleteGroupInvitation,
  updateGroupInvitation,
} from "@/lib/actions/group-invitation";
import type { InvitationValues } from "@/lib/actions/group-invitation.schema";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";
import type { GroupInvitationSummary } from "@/lib/api/group-invitation";
import { toDateTimeLocal } from "@/lib/format/datetime-local";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { CopyButton } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";
import { PencilIcon } from "@/components/icons";

/**
 * The links that let people join this group (T-018), for whoever may mint them.
 *
 * A link is the whole product here, so the list shows the **address itself**, with a copy button
 * beside it rather than in place of it: a teacher pastes it into a course page or an email, and
 * needs to see what they are pasting as well as not have to select it by hand. `origin` is
 * resolved on the server from the request's own `Host` -- this component cannot read
 * `window.location` without a hydration mismatch, and guessing from `API_BASE_PUBLIC` would be
 * right in the container and wrong in dev.
 *
 * Expired links stay listed, marked. core-api keeps the record until someone deletes it, and the
 * two are genuinely different: an expired link can be given a new date, a deleted one 404s
 * forever. The screen offers both.
 */
/**
 * The expiry stays a wall-clock string while it is being typed and becomes unix seconds on the way
 * to the action, because only the browser knows which zone the reader typed it in
 * (`lib/format/datetime-local.ts`). An empty picker is a link that never expires.
 */
type InvitationDraft = { note: string; expiresAt: string };

function submitted(draft: InvitationDraft): InvitationValues {
  return { note: draft.note, expiresAt: fromDateTimeLocal(draft.expiresAt) };
}

export function InvitationManager({
  groupId,
  invitations,
  origin,
  canEdit,
}: {
  groupId: string;
  invitations: GroupInvitationSummary[];
  origin: string;
  canEdit: boolean;
}) {
  const t = useTranslations("Group.invitations");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvitationDraft>({ note: "", expiresAt: "" });

  const invitationLink = (invitationId: string) =>
    `${origin}/accept-group-invitation/${invitationId}`;

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
  const primary =
    "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (result.success) {
      setDeleting(null);
      setEditing(null);
      setDraft({ note: "", expiresAt: "" });
      toast.success(t(successKey));
      router.refresh();
    } else {
      toast.error(t("failed"), result.formError);
    }
  }

  function startEditing(invitation: GroupInvitationSummary) {
    setEditing(invitation.id);
    setDraft({
      note: invitation.note,
      expiresAt: invitation.expireAt === null ? "" : toDateTimeLocal(invitation.expireAt),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">
                  {invitationLink(invitation.id)}
                </code>
                <CopyButton
                  value={invitationLink(invitation.id)}
                  label={t("copyNamed", { note: invitation.note || invitation.id })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {invitation.hasExpired
                    ? t("expired")
                    : invitation.expireAt === null
                      ? t("neverExpires")
                      : t("expiresOn", {
                          date: format.dateTime(
                            new Date(invitation.expireAt * 1000),
                            DATE_TIME_FORMAT,
                          ),
                        })}
                  {invitation.hostName && ` · ${t("mintedBy", { name: invitation.hostName })}`}
                </span>
                {canEdit && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className={buttonClasses("warning-outline", "sm")}
                      aria-label={t("editNamed", { note: invitation.note || invitation.id })}
                      onClick={() => startEditing(invitation)}
                    >
                      <PencilIcon className="size-4" />
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className={button}
                      aria-label={t("deleteNamed", { note: invitation.note || invitation.id })}
                      onClick={() => setDeleting(invitation.id)}
                    >
                      {t("delete")}
                    </button>
                  </span>
                )}
              </div>
              {invitation.note && <p>{invitation.note}</p>}

              {editing === invitation.id && (
                <InvitationFields
                  draft={draft}
                  setDraft={setDraft}
                  pending={pending}
                  submitLabel={t("save")}
                  onCancel={() => setEditing(null)}
                  onSubmit={() =>
                    void run(
                      () => updateGroupInvitation(invitation.id, submitted(draft)),
                      "updated",
                    )
                  }
                  labels={{
                    note: t("note"),
                    expiresAt: t("expiresAt"),
                    hint: t("expiresAtHint"),
                    cancel: t("cancel"),
                  }}
                  classes={{ input, button, primary }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && editing === null && (
        <div className="rounded-lg border border-dashed border-border p-3">
          <h3 className="mb-2 text-sm font-medium">{t("createTitle")}</h3>
          <InvitationFields
            draft={draft}
            setDraft={setDraft}
            pending={pending}
            submitLabel={t("create")}
            onSubmit={() =>
              void run(() => createGroupInvitation(groupId, submitted(draft)), "created")
            }
            labels={{
              note: t("note"),
              expiresAt: t("expiresAt"),
              hint: t("expiresAtHint"),
              cancel: t("cancel"),
            }}
            classes={{ input, button, primary }}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        pending={pending}
        onConfirm={() => {
          if (deleting) void run(() => deleteGroupInvitation(deleting), "deleted");
        }}
      />
    </div>
  );
}

function InvitationFields({
  draft,
  setDraft,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
  labels,
  classes,
}: {
  draft: InvitationDraft;
  setDraft: (values: InvitationDraft) => void;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  labels: { note: string; expiresAt: string; hint: string; cancel: string };
  classes: { input: string; button: string; primary: string };
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{labels.note}</span>
        <input
          type="text"
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          className={classes.input}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="invitation-expires-at" className="font-medium">
          {labels.expiresAt}
        </label>
        <span id="invitation-expires-at-hint" className="text-xs text-muted-foreground">
          {labels.hint}
        </span>
        <input
          id="invitation-expires-at"
          aria-describedby="invitation-expires-at-hint"
          type="datetime-local"
          value={draft.expiresAt}
          onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
          className={classes.input}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={pending} className={classes.primary} onClick={onSubmit}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" disabled={pending} className={classes.button} onClick={onCancel}>
            {labels.cancel}
          </button>
        )}
      </div>
    </div>
  );
}
