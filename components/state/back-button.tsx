"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { BackIcon } from "@/components/icons";

/**
 * One step back, on the pages that say a reader cannot be where they are.
 *
 * Replaces a link to the front page, which was the wrong offer: somebody refused a tab inside a
 * course wants that course back, not the product's front door. Operator-requested after walking
 * into exactly that.
 *
 * `history.length` is the fallback's trigger rather than a referrer check: a page opened straight
 * from a bookmark or a pasted address has nowhere to go back to, and `router.back()` there does
 * nothing at all, which is worse than a button that visibly goes somewhere.
 */
export function BackButton({ className }: { className?: string }) {
  const t = useTranslations("Status");
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push("/");
      }}
      className={className}
    >
      <BackIcon />
      {t("back")}
    </button>
  );
}
