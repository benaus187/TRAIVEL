import { create } from "zustand";

type CurrencyStore = {
  currency: string;
  symbol: string;
  rate: number; // 1 USD = rate local units
  setCurrency: (currency: string, symbol: string, rate: number) => void;
};

export const useCurrencyStore = create<CurrencyStore>((set) => ({
  currency: "USD",
  symbol: "$",
  rate: 1,
  setCurrency: (currency, symbol, rate) => set({ currency, symbol, rate }),
}));
