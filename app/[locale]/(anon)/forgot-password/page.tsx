import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BackIcon } from "@/components/icons";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { RouteMessages } from "@/components/route-messages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ForgotPassword" });
  return { title: t("title") };
}

/**
 * Asking for a password-reset email (A-004).
 *
 * Public on purpose -- somebody who cannot sign in is exactly who needs it -- and it stays
 * reachable for a signed-in reader too (`proxy.ts` does not bounce this one), because resetting a
 * password you can still use is a normal thing to want to do.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("ForgotPassword");

  return (
    <RouteMessages>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("explain")}</p>
        </div>

        <ForgotPasswordForm />

        <p className="text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <BackIcon />
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </RouteMessages>
  );
}
