import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getShadowAssignmentSettings } from "@/lib/api/shadow-assignment";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { ShadowAssignmentForm } from "@/components/assignments/shadow-assignment-form";
import { PageShell } from "@/components/page-shell";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shadow.edit" });
  return { title: t("title") };
}

/**
 * A shadow assignment's settings (G-009) -- the screen `scripts/seed.ts` had to stand in for,
 * because until now the entity could be read and awarded points and never created or changed.
 *
 * **The refusal is an explicit check, not `apiRead`'s**, for T-002's reason: reading a shadow
 * assignment is something a student may legitimately do -- it is theirs -- so the fetch succeeds
 * for them and only the save would be refused. Being handed a filled-in form for something you may
 * not change is its own defect, whether or not anything was ever writable.
 */
export default async function EditShadowAssignmentPage({
  params,
}: {
  params: Promise<{ shadowId: string }>;
}) {
  const [{ shadowId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("Shadow.edit"),
    getShadowAssignmentSettings(shadowId, locale, routing.locales),
  ]);
  if (assignment.can.update !== true) forbidden();

  const breadcrumbs = await resolveBreadcrumbs(`/shadow-assignments/${shadowId}/edit`, locale);
  const named = assignment.texts.find((text) => text.name.trim() !== "");

  return (
    <PageShell
      title={t("title")}
      subtitle={named?.name ?? ""}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/shadow-assignments/${shadowId}`} className={buttonClasses("outline", "sm")}>
          <BackIcon />
          {t("backToAssignment")}
        </Link>
      }
    >
      <div className="flex max-w-3xl flex-col gap-10">
        <ShadowAssignmentForm assignment={assignment} />
      </div>
    </PageShell>
  );
}
