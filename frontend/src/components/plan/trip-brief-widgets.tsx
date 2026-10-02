"use client";

import { cn } from "@/lib/utils";

/** Selectable tap-card — used for pace, transport, and interest tiles in both shells. */
export function TapCard({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-xl border-[1.5px] px-3 py-2.5 text-xs font-mono transition-[scale,background-color,border-color,box-shadow] duration-150 active:scale-95",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        selected
          ? "border-vermilion bg-vermilion/10 text-foreground shadow-[0_0_0_3px_color-mix(in_oklch,var(--vermilion)_18%,transparent)]"
          : "border-line-strong bg-card text-muted-foreground hover:border-foreground/40",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Selectable pill chip — used for interests/avoid lists. */
export function Chip({
  selected,
  onClick,
  children,
  tone = "default",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono transition-[scale,background-color,border-color] duration-150 active:scale-95",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        selected
          ? tone === "destructive"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-foreground bg-foreground text-background"
          : "border-line-strong bg-card text-muted-foreground hover:border-foreground/40"
      )}
    >
      {children}
    </button>
  );
}

/** Stepper for a small bounded integer — used by the Custom pace min-stops control. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-background px-3 py-2 text-xs">
      <span className="font-mono text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2.5 font-mono">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex size-6 items-center justify-center rounded-full border border-line-strong bg-card hover:border-foreground/40"
        >
          –
        </button>
        <span className="min-w-[1.5ch] text-center font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-6 items-center justify-center rounded-full border border-line-strong bg-card hover:border-foreground/40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export const INTEREST_ICONS: Record<string, string> = {
  "food & drink": "🍜",
  "art & culture": "🎨",
  "nature & outdoors": "🌿",
  history: "🏛️",
  shopping: "🛍️",
  nightlife: "🌙",
  architecture: "🏙️",
  "street food": "🥟",
};

export const AVOID_ICONS: Record<string, string> = {
  "crowded places": "🥵",
  "tourist traps": "🙅",
  nightlife: "🌙",
  "street food": "🥟",
  "steep hills": "⛰️",
  "early mornings": "⏰",
};

export const PACE_EMOJI: Record<string, string> = {
  relaxed: "🌤️",
  moderate: "🚶",
  packed: "⚡",
  custom: "🎛️",
};

export const TRANSPORT_EMOJI: Record<string, string> = {
  public_transport: "🚇",
  walking: "🚶",
  any: "🔀",
};
