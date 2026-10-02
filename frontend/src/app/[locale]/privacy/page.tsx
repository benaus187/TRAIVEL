import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
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
        <h2 className="font-semibold text-base">{t("collected.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("collected.body")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">{t("thirdParty.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("thirdParty.body")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">{t("controls.heading")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("controls.body")}{" "}
          <a href="mailto:bangluonghuynh950@gmail.com" className="text-vermilion hover:underline">
            bangluonghuynh950@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
