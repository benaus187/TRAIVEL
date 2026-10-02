import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("intro")}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">{t("usingItinerary.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("usingItinerary.body")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">{t("billing.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("billing.body")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">{t("noWarranty.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("noWarranty.body")}{" "}
          <a href="mailto:bangluonghuynh950@gmail.com" className="text-vermilion hover:underline">
            bangluonghuynh950@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
