"use client";

import { AlertDialog } from "radix-ui";
import { useTranslations } from "next-intl";

/**
 * Confirmation for destructive and otherwise irreversible actions (D-006; brief §9's "Destructive
 * actions confirm").
 *
 * Built on Radix's **`AlertDialog`**, not the plain `Dialog` above, and the difference is not
 * cosmetic: `AlertDialog` renders `role="alertdialog"` (announced by assistive tech as demanding a
 * response rather than as an ordinary dialog), requires an explicit Action/Cancel pair, moves
 * initial focus to Cancel rather than to the first focusable element, and -- the part that matters
 * most for a destructive action -- **does not dismiss on an outside click**, only on `Escape` or a
 * deliberate choice. Confirmed in the installed `@radix-ui/react-alert-dialog`, which overrides
 * `onPointerDownOutside`/`onInteractOutside` with `event.preventDefault()` rather than merely
 * documenting the behaviour. Reproducing any of that on top of the plain `Dialog` would be
 * re-deriving a primitive that already ships here.
 *
 * Controlled (`open`/`onOpenChange`) rather than trigger-driven: the actions that need confirming
 * are row actions and menu items whose trigger is somewhere else entirely, and a caller that does
 * have a natural trigger can still pass `trigger`.
 */
export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional inline trigger, for the simple "button right next to the dialog" case. */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Anything the reader has to look at or touch before answering -- a list of what will be
   *  overwritten, a checkbox each. Sits below the description, outside it: `AlertDialog.Description`
   *  renders a `<p>`, which may not contain a list or a control. */
  children?: React.ReactNode;
  /** Defaults to the shared "Confirm" string; pass the actual verb ("Delete group") where you can. */
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** Styles the confirm button as destructive. Defaults to true -- this component's whole reason to exist. */
  destructive?: boolean;
  onConfirm: () => void;
  /** Disables the confirm button while the caller's action is in flight. */
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const t = useTranslations("Dialog");

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in"
        />
        <AlertDialog.Content
          data-slot="dialog-content"
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-background p-6 shadow-lg outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-lg font-semibold text-foreground">
              {title}
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
            ) : null}
          </div>

          {children}

          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel
              disabled={pending}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {cancelLabel ?? t("cancel")}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              disabled={pending}
              onClick={onConfirm}
              className={`rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {confirmLabel ?? t("confirm")}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
