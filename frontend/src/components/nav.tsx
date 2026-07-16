import { Separator } from "@/components/ui/separator";

export function Nav() {
  return (
    <header className="w-full">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="/plan" className="hover:text-foreground transition-colors">
            Plan a trip
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            My trips
          </a>
        </nav>
      </div>
      <Separator />
    </header>
  );
}

function Wordmark() {
  return (
    <span className="font-semibold text-lg tracking-tight select-none">
      TR
      <span className="font-black text-foreground border-b-2 border-foreground pb-[1px]">
        AI
      </span>
      VEL
    </span>
  );
}
