export const metadata = {
  title: "Privacy Policy — TRAIVEL",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Privacy Policy</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">What TRAIVEL does with your data</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          TRAIVEL is a solo-built portfolio project, not a company. This page describes what actually
          happens to your data when you use it.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">What's collected</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you sign in, your email address and (for Google sign-in) your name and avatar are stored via
          Supabase Auth. Trip briefs you submit (destination, dates, interests, budget) and the itineraries
          generated from them are stored so you can revisit and share your trips. Anonymous, signed-out use
          is also supported and doesn't require an account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Third-party services</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Generating an itinerary sends your trip brief to Anthropic's Claude API. Place names are checked
          against the Google Places API and Open-Meteo for weather; YouTube Data API is used for trend
          signals. Payments (Premium plan) are processed by Stripe — TRAIVEL never sees or stores your card
          details. None of your data is sold to third parties.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Your controls</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can delete your trips from the My Trips page. To delete your account entirely or ask any
          question about your data, email{" "}
          <a href="mailto:bangluonghuynh950@gmail.com" className="text-vermilion hover:underline">
            bangluonghuynh950@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
