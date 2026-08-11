export const metadata = {
  title: "Terms of Service — TRAIVEL",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Terms of Service</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">The short version</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          TRAIVEL is a solo-built portfolio project, provided as-is with no warranty of any kind.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Using the itinerary</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Itineraries are AI-generated and cross-checked against Google Places and weather data at the time
          they're created, but places can close, change hours, or stop existing. Always double-check
          opening hours, prices, and availability before you rely on a stop — especially for anything
          time-sensitive or booked in advance.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Premium plan &amp; billing</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Premium subscriptions are billed and managed through Stripe. You can view invoices, update your
          payment method, or cancel anytime from the billing portal linked on the Pricing page — cancelling
          stops future charges but doesn't retroactively refund the current billing period.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">No warranty</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          TRAIVEL is offered without warranties of any kind, express or implied. It's not liable for travel
          decisions made based on its output. If something looks broken or wrong, email{" "}
          <a href="mailto:bangluonghuynh950@gmail.com" className="text-vermilion hover:underline">
            bangluonghuynh950@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
