"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";

import {
  createSystemMessage,
  deleteSystemMessage,
  updateSystemMessage,
} from "@/lib/actions/system-messages";
import {
  systemMessageFormSchema,
  systemMessageFormToValues,
  type SystemMessageFormValues,
} from "@/lib/actions/system-messages.schema";
import { USER_ROLES } from "@/lib/api/user-roles";
import { MESSAGE_TYPES } from "@/lib/api/message-types";
import type { SystemMessage } from "@/lib/api/system-messages";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import { toDateTimeLocal } from "@/lib/format/datetime-local";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/dialog/dialog";
import { Field } from "@/components/form/field";
import { FormError } from "@/components/form/form-error";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";
import { PencilIcon } from "@/components/icons";

/**
 * Every broadcast there is, and the editor that writes one (AD-007).
 *
 * **A message's window is the whole of its lifecycle** -- there is no draft, no published flag and
 * no archive. It is live between `visibleFrom` and `visibleTo` and invisible outside them, so the
 * list groups by that rather than by a status core-api does not have: what is showing now, what is
 * queued, and what has been and gone.
 *
 * **Editing replaces**, because core-api's update endpoint requires the same full body as create.
 * One dialog therefore serves both, seeded either from a message or from a sensible new one -- a
 * week from now, addressed to everybody.
 */
export function MessageManager({
  messages,
  locales,
}: {
  messages: SystemMessage[];
  /** Every language this app speaks; a message may be written in any subset of them. */
  locales: readonly string[];
}) {
  const t = useTranslations("SystemMessages");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<SystemMessage | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SystemMessage | null>(null);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  async function remove() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteSystemMessage(deleting.id);
    setPending(false);
    if (!result.success) {
      toast.error(t("errors.deleteFailed"), result.formError);
      return;
    }
    setDeleting(null);
    toast.success(t("deleted"));
    router.refresh();
  }

  const button =
    "rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  const at = (unixSeconds: number) =>
    format.dateTime(new Date(unixSeconds * 1000), DATE_TIME_FORMAT);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className={buttonClasses("primary", "sm", "self-start")}
      >
        {t("create")}
      </button>

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.text")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.audience")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.window")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => {
                const live = message.visibleFrom <= now && message.visibleTo > now;
                const queued = message.visibleFrom > now;
                return (
                  <tr
                    key={message.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <span className="flex flex-col gap-1">
                        {message.texts.map((text) => (
                          <span key={text.locale} className="flex gap-2">
                            <span className="font-mono text-xs text-muted-foreground uppercase">
                              {text.locale}
                            </span>
                            <span>{text.text}</span>
                          </span>
                        ))}
                        <span className="flex flex-wrap gap-1">
                          <Badge
                            tone={
                              message.type === "danger"
                                ? "danger"
                                : message.type === "warning"
                                  ? "warning"
                                  : message.type === "success"
                                    ? "success"
                                    : "info"
                            }
                          >
                            {t(`types.${message.type}`)}
                          </Badge>
                          {live && <Badge tone="success">{t("state.live")}</Badge>}
                          {queued && <Badge tone="neutral">{t("state.queued")}</Badge>}
                          {!live && !queued && <Badge tone="neutral">{t("state.past")}</Badge>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {t("audience", { role: t(`roles.${message.role}`) })}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {at(message.visibleFrom)} — {at(message.visibleTo)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          className={buttonClasses("warning-outline", "xs")}
                          onClick={() => setEditing(message)}
                        >
                          <PencilIcon className="size-3.5" />
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className={`${button} text-destructive`}
                          onClick={() => setDeleting(message)}
                        >
                          {t("delete")}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <MessageEditor
          key={editing?.id ?? "new"}
          message={editing}
          locales={locales}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete")}
        description={t("confirmDelete")}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

/** Seeds a new message a week long, starting now, addressed to everybody. */
function newMessageValues(locales: readonly string[]): SystemMessageFormValues {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
  return {
    texts: locales.map((locale) => ({ locale, text: "" })),
    type: "info",
    role: "student",
    visibleFrom: toDateTimeLocal(Math.floor(start.getTime() / 1000)),
    visibleTo: toDateTimeLocal(Math.floor(end.getTime() / 1000)),
  };
}

function MessageEditor({
  message,
  locales,
  onClose,
}: {
  message: SystemMessage | null;
  locales: readonly string[];
  onClose: () => void;
}) {
  const t = useTranslations("SystemMessages.editor");
  const router = useRouter();
  const toast = useToast();

  const tErrors = useTranslations("SystemMessages.errors");

  const { form, onSubmit, isPending } = useServerActionForm<
    SystemMessageFormValues,
    { id: string }
  >({
    schema: systemMessageFormSchema,
    defaultValues: message
      ? {
          // Every language gets a field, seeded from whichever the message was written in.
          texts: locales.map((locale) => ({
            locale,
            text: message.texts.find((text) => text.locale === locale)?.text ?? "",
          })),
          type: message.type,
          role: message.role as SystemMessageFormValues["role"],
          visibleFrom: toDateTimeLocal(message.visibleFrom),
          visibleTo: toDateTimeLocal(message.visibleTo),
        }
      : newMessageValues(locales),
    action: (values) => {
      const payload = systemMessageFormToValues(values);
      if (payload === null) {
        return Promise.resolve({ success: false as const, formError: tErrors("badDate") });
      }
      return message ? updateSystemMessage(message.id, payload) : createSystemMessage(payload);
    },
    onSuccess: () => {
      toast.success(t(message ? "saved" : "created"));
      onClose();
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors },
  } = form;
  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t(message ? "editTitle" : "createTitle")} description={t("explain")}>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormError />

            {locales.map((locale, index) => (
              <Field key={locale} label={t("text", { locale: locale.toUpperCase() })}>
                <textarea rows={2} className={input} {...register(`texts.${index}.text`)} />
                <input type="hidden" {...register(`texts.${index}.locale`)} />
              </Field>
            ))}
            {errors.texts && (
              <p role="alert" className="text-sm text-destructive">
                {t("errors.textRequired")}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("type")}>
                <select className={input} {...register("type")}>
                  {MESSAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("role")} description={t("roleHint")}>
                <select className={input} {...register("role")}>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`roles.${role}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("visibleFrom")}>
                <input type="datetime-local" className={input} {...register("visibleFrom")} />
              </Field>
              <Field
                label={t("visibleTo")}
                error={errors.visibleTo && t("errors.endsBeforeItStarts")}
              >
                <input type="datetime-local" className={input} {...register("visibleTo")} />
              </Field>
            </div>

            <DialogFooter>
              <button type="button" onClick={onClose} className={buttonClasses("outline", "sm")}>
                {t("cancel")}
              </button>
              <button type="submit" disabled={isPending} className={buttonClasses("primary", "sm")}>
                {t(message ? "save" : "create")}
              </button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
