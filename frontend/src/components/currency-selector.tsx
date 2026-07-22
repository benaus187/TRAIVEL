"use client";

import { useCurrencyStore } from "@/stores/currency-store";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "VND", symbol: "₫" },
  { code: "AUD", symbol: "A$" },
  { code: "NZD", symbol: "NZ$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "THB", symbol: "฿" },
  { code: "SGD", symbol: "S$" },
];

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrencyStore();

  async function handleChange(code: string) {
    const cur = CURRENCIES.find((c) => c.code === code);
    if (!cur) return;
    if (code === "USD") {
      setCurrency("USD", "$", 1);
      return;
    }
    // Optimistic: switch currency label immediately, fetch real rate
    setCurrency(code, cur.symbol, 1);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      const rate: number = data.rates?.[code];
      if (rate) setCurrency(code, cur.symbol, rate);
    } catch {
      // rate stays at 1 on failure
    }
  }

  return (
    <select
      value={currency}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs font-mono text-muted-foreground bg-transparent border border-border rounded px-1.5 py-0.5 cursor-pointer hover:text-foreground transition-colors focus:outline-none"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code}
        </option>
      ))}
    </select>
  );
}
