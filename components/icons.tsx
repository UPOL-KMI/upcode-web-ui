/**
 * The few icons the app's buttons carry, drawn the way every other icon here is drawn: inline SVG
 * on a 20-unit box, stroked in `currentColor`, so an icon takes the colour of the button it sits in
 * -- the warning orange of an edit, the white of a primary -- with nothing to keep in step.
 *
 * Always `aria-hidden`: the button's own text is its name, and an icon that announced itself would
 * say the same thing twice.
 */
function Icon({
  children,
  className = "size-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

/** Editing something, and grading it. */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
      <path d="M11.5 5.5l3 3" />
    </Icon>
  );
}

/** Going back to where this page was reached from: a U on its side with the arrow at its foot. */
export function BackIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M7.5 12.5 3 8l4.5-4.5" />
      <path d="M3 8h9.5a4.5 4.5 0 0 1 0 9H10" />
    </Icon>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 3v10" />
      <path d="M6 9.5l4 4 4-4" />
      <path d="M4 16.5h12" />
    </Icon>
  );
}

/** A stack of things to pick from: the student's attempts, opened in a dialog. */
export function AttemptsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3" y="7" width="11" height="10" rx="1.5" />
      <path d="M6 4.5h9.5A1.5 1.5 0 0 1 17 6v8" />
    </Icon>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 10.5l4 4 8-9" />
    </Icon>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 3 2.5 16.5h15z" />
      <path d="M10 8v4" />
      <path d="M10 14.5v.01" />
    </Icon>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5" />
      <path d="M10 6.5v.01" />
    </Icon>
  );
}
