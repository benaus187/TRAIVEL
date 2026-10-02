import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LiveAssemblyHero } from "@/components/home/live-assembly-hero";
import { WhyTraivelBento } from "@/components/home/why-traivel-bento";
import { CitySampler } from "@/components/home/city-sampler";
import { TrustLine } from "@/components/home/trust-line";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-6">
        <LiveAssemblyHero />
        <WhyTraivelBento />
        <CitySampler />
        <TrustLine />
        <BottomCTA />
      </div>
      <Footer />
    </>
  );
}

function BottomCTA() {
  const t = useTranslations("home.bottomCta");
  return (
    <section className="py-16 border-t border-border text-center space-y-5">
      <h2 className="text-2xl font-bold">
        {t("titlePrefix")}{" "}
        <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
          {t("titleItalic")}
        </span>
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        {t("subtitle")}
      </p>
      <Link href="/plan">
        <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7 mt-2">
          {t("cta")}
        </Button>
      </Link>
    </section>
  );
}
