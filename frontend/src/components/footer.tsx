import Link from "next/link";
import { Wordmark } from "@/components/nav";

const FIELDS: { label: string; value: string; href: string }[] = [
  { label: "Email", value: "bangluonghuynh950@gmail.com", href: "mailto:bangluonghuynh950@gmail.com" },
  { label: "GitHub", value: "github.com/benaus187/TRAIVEL", href: "https://github.com/benaus187/TRAIVEL" },
  { label: "LinkedIn", value: "Luong Bang Huynh", href: "https://www.linkedin.com/in/luong-bang-huynh-3029b72b5" },
];

export function Footer() {
  return (
    <footer className="bg-navy text-board-fg no-print">
      <div className="max-w-3xl mx-auto px-6 pt-7 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-8 pb-6">
          <div className="max-w-[26ch]">
            <Wordmark className="text-board-fg" />
            <p className="mt-2 text-sm leading-relaxed text-board-fg/60">
              Every stop verified. Every reason explained.
            </p>
          </div>
          <div className="flex flex-wrap gap-7">
            {FIELDS.map((field, i) => (
              <div
                key={field.label}
                className={`flex flex-col gap-1 ${i > 0 ? "pl-5 border-l-2 border-dashed border-board-fg/20" : ""}`}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-board-fg/55">
                  {field.label}
                </span>
                <a
                  href={field.href}
                  target={field.href.startsWith("http") ? "_blank" : undefined}
                  rel={field.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="font-mono text-xs text-board-fg hover:text-vermilion hover:underline"
                >
                  {field.value}
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-board-fg/15 font-mono text-[11px] text-board-fg/55">
          <span>© 2026 TRAIVEL</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-board-fg hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-board-fg hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
