"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog/dialog";
import { AttemptsIcon } from "@/components/icons";

/**
 * The student's other attempts, opened from the grading bar (X-031).
 *
 * The table itself is `SolutionList`, rendered on the server and handed in as children, so it is
 * the very table of the student's attempts page and not a second one to keep in step. Picking an
 * attempt is a link: the page under the dialog changes, and the dialog closes on the click rather
 * than staying open over the new attempt, which a client navigation would otherwise leave it doing.
 */
export function AttemptsDialog({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Underlined and iconed like the link it behaves as: plain grey text read as a caption. */}
      <DialogTrigger className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <AttemptsIcon className="size-3.5" />
        {label}
      </DialogTrigger>
      <DialogContent
        title={title}
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        onClick={(event) => {
          if ((event.target as Element).closest("a")) setOpen(false);
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
