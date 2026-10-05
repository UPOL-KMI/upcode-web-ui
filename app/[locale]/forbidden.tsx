import { getTranslations } from "next-intl/server";

import { BackButton } from "@/components/state/back-button";
import { StatusState } from "@/components/state/status-state";
import { buttonClasses } from "@/components/button";

// Renders when forbidden() is called (experimental.authInterrupts, see next.config.ts) --
// 403, permission denied for an authenticated user. Distinct from unauthorized.tsx (401, not
// signed in at all). Shared layout via D-008's StatusState.
export default async function Forbidden() {
  const t = await getTranslations("Forbidden");

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <StatusState
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <BackButton className={buttonClasses("outline", "sm")} />
            {/* The way out of a refusal, and it has to be here: this page renders outside the app
                shell, so there is no navigation and no sign-out on it, and `proxy.ts` sends a
                signed-in visitor from `/login` to `/dashboard` -- which is itself refused when the
                refusal is the dashboard's. Without this a reader is stranded on the public front
                page with no control that changes anything. A plain link rather than the logout
                Route Handler because that one is POST by design (CSRF); this GET route clears the
                same cookie and lands on the sign-in page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a Route Handler,
                not a page: it must be a real navigation so the response's Set-Cookie applies. */}
            <a href="/api/auth/session-expired" className={buttonClasses("outline", "sm")}>
              {t("signOutLink")}
            </a>
          </div>
        }
      />
    </main>
  );
}
