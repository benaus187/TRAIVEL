import Link from "next/link";
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
  return (
    <section className="py-16 border-t border-border text-center space-y-5">
      <h2 className="text-2xl font-bold">
        Unlike ChatGPT,{" "}
        <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
          TRAIVEL shows its work.
        </span>
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Every stop verified. Every reason explained. Real data, not hallucinations.
      </p>
      <Link href="/plan">
        <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7 mt-2">
          Start planning →
        </Button>
      </Link>
    </section>
  );
}
