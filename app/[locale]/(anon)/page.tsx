import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPublicInstances } from "@/lib/api/instances";

import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/markdown/markdown";
import { RouteMessages } from "@/components/route-messages";
import { buttonClasses } from "@/components/button";

/**
 * The front door (A-001) -- what ReCodEx is, which instance this is, and how any of it works.
 *
 * **Purely public, and that is a change from the legacy page rather than a simplification of it.**
 * The legacy `Home` is one screen for both audiences: it branches on the reader's role, hides the
 * exercise section from students, and shows the instance block only to those signed in. Here `/`
 * is the front door and `/dashboard` is the signed-in home (`docs/IA.md` §2), so this page reads
 * the same for everybody and reads no session at all -- `readSessionToken` says in as many words
 * that it is not a general "is the reader signed in" helper, and inventing one for a marketing
 * page would be the wrong place to start (DEC-116).
 *
 * That has one neat consequence: the sign-in link needs no branch. `proxy.ts` already sends a
 * visitor who *does* have a session from `/login` to `/dashboard`, so the same link is right for
 * both.
 *
 * The instance's name and description come from `/v1/instances`, which core-api grants to the
 * `unauthenticated` role -- the same read the registration form makes, now shared. The
 * description is authored markdown, so it is rendered as such.
 *
 * Moved into the `(anon)` route group on the way: at `app/[locale]/page.tsx` it had no `<main>`
 * landmark and no language switch, which every other anonymous page got from that group's layout
 * when S-024 found the same gap.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, instances] = await Promise.all([getTranslations("HomePage"), getPublicInstances()]);

  // A deployment normally runs one; naming it is the point, and where there are several this is
  // the same list the registration form offers.
  const instance = instances[0] ?? null;
  const helpdesk = process.env.EXTERNAL_AUTH_HELPDESK_URL ?? "";

  const sections = ["groups", "exercises", "solutions", "deadlines"] as const;

  return (
    <RouteMessages>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="border-l-4 border-primary pl-4 text-xl">{t("tagline")}</p>
          <p className="text-sm text-muted-foreground">{t("operator")}</p>
          <p className="text-sm">{t("what")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className={buttonClasses("primary", "md")}>
              {t("signIn")}
            </Link>
            <Link href="/docs" className={buttonClasses("outline", "md")}>
              {t("docs.link")}
            </Link>
          </div>
        </header>

        {instance && (
          <section aria-labelledby="home-instance" className="flex flex-col gap-2">
            <h2 id="home-instance" className="text-lg font-semibold tracking-tight text-primary">
              {t("instance.title")}
            </h2>
            <p className="text-sm font-medium">{instance.name}</p>
            {instance.description && <Markdown source={instance.description} />}
            {helpdesk !== "" && (
              <p className="text-sm">
                <a
                  href={helpdesk}
                  className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("instance.support")}
                </a>
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="home-quickstart" className="flex flex-col gap-6">
          <h2 id="home-quickstart" className="text-lg font-semibold tracking-tight text-primary">
            {t("quickStart.title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((section) => (
              <div
                key={section}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5"
              >
                <h3 className="text-sm font-semibold">{t(`quickStart.${section}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`quickStart.${section}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">{t("acknowledgement")}</p>
          <p className="flex flex-wrap gap-4 text-sm">
            <a
              href="https://github.com/UPOL-KMI/upcode-web-ui"
              target="_blank"
              rel="noreferrer"
              className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("links.source")}
            </a>
            <a
              href="https://github.com/ReCodEx/wiki/wiki"
              target="_blank"
              rel="noreferrer"
              className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("links.docs")}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">{t("license")}</p>
        </footer>
      </div>
    </RouteMessages>
  );
}
