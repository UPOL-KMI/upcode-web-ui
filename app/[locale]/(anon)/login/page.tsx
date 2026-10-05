import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { externalAuthProvider } from "@/lib/auth/external-auth";
import { localRegistrationEnabled } from "@/lib/auth/registration";
import { shortSessionSeconds } from "@/lib/auth/short-session";

import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { BackIcon } from "@/components/icons";
import { RouteMessages } from "@/components/route-messages";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Login" });
  return { title: t("title") };
}

/**
 * Signing in (A-002) -- the app's front door, and until now a `PlaceholderPage` in front of a real
 * BFF route that only the e2e suite ever called.
 *
 * Three things reach this page from elsewhere and each says why the reader is here: `?from=`,
 * which `proxy.ts` writes when it refuses a page to somebody without a session;
 * `?externalAuthError=1`, which the external-auth callback redirects to when a token is missing or
 * refused (F-019); and nothing at all, which is somebody signing in on purpose.
 *
 * **A visitor who already has a session never sees this**: `proxy.ts` sends them to the dashboard,
 * which is why there is no "you are already signed in" branch here, unlike the legacy page.
 *
 * External sign-in is offered where a provider is configured (A-007) and is **absent here**,
 * because this deployment configures none -- no authenticator name, no URL, no shared secret
 * (Q-004). It is an ordinary link rather than the legacy app's popup: F-019 built the callback as
 * a redirect target, so there is no second window to hand a token back from (DEC-117).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; externalAuthError?: string; passwordChanged?: string }>;
}) {
  const [query, t] = await Promise.all([searchParams, getTranslations("Login")]);
  const shortSession = shortSessionSeconds();
  const external = externalAuthProvider();

  return (
    <RouteMessages>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
        {/* The way back out. `proxy.ts` sends a visitor here from any page that needs a session,
            so this is where somebody who did not mean to sign in ends up. */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BackIcon />
          {t("backToHome")}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {query.from && (
          <p className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">
            {t("signInRequired")}
          </p>
        )}

        {query.passwordChanged && (
          <p className="rounded-lg border border-success bg-success/10 p-3 text-sm">
            {t("passwordChanged")}
          </p>
        )}

        {query.externalAuthError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            {t("externalAuthFailed")}
          </p>
        )}

        <LoginForm
          from={query.from}
          shortSessionMinutes={shortSession === null ? null : Math.round(shortSession / 60)}
        />

        {/* A plain link, and a plain full navigation: the provider sends the browser back to
            `/api/auth/external/{service}/callback`, which establishes the session itself. Nothing is
            appended to the URL -- where it returns to is the provider's own configuration. */}
        {external && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">{t("externalIntro")}</p>
            <a href={external.url} className={buttonClasses("outline", "md", "text-center")}>
              {t("externalSignIn", { name: external.name })}
            </a>
          </div>
        )}

        <p className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("forgotPassword")}
          </Link>
          {/* Only where this deployment lets people create their own accounts (A-003): a link to a
              page that explains it cannot be done is a link nobody should be offered. */}
          {localRegistrationEnabled() && (
            <Link
              href="/register"
              className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("createAccount")}
            </Link>
          )}
        </p>
      </div>
    </RouteMessages>
  );
}
