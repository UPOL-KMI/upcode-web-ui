import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitch } from "@/components/app-shell/locale-switch";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";

/**
 * Shared shell for pages reachable without a session (login, register, password reset, the
 * guides, ...). A visitor has no sidebar, so the mark, the language switch (A-008) and the
 * appearance switch live in a header instead; the `<main>` landmark is here because every
 * anonymous page was missing one until S-024's spec reached for it.
 *
 * **The header's container is `PageShell`'s container, deliberately.** The guides render through
 * `PageShell` (`max-w-6xl`, `lg:px-8`) while this header used `max-w-4xl`, so the mark sat an inch
 * inside the text it headed. The two numbers have to agree; the landing page keeps its narrower
 * column *inside* the same outer container rather than by being narrower than it.
 */
export default function AnonLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark href="/" />
          <div className="flex items-center gap-3">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
