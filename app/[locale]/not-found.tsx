import { getTranslations } from "next-intl/server";

import { BackButton } from "@/components/state/back-button";
import { buttonClasses } from "@/components/button";
import { StatusState } from "@/components/state/status-state";

// Renders for notFound() calls within the [locale] segment, and for any locale-prefixed URL
// that doesn't match a route (proxy.ts redirects unprefixed paths into a locale first, so this
// covers the realistic "unmatched URL" case -- see docs/DECISIONS.md for why global-not-found.js
// wasn't added on top of this). Uses D-008's shared StatusState so this reads as the same app as
// every other empty/error surface.
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <StatusState
        title={t("title")}
        description={t("description")}
        action={<BackButton className={buttonClasses("outline", "sm")} />}
      />
    </main>
  );
}
