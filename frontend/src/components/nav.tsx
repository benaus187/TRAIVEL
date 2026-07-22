"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CurrencySelector } from "@/components/currency-selector";

export function Nav() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="w-full">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <CurrencySelector />
          <Link href="/plan" className="text-muted-foreground hover:text-foreground transition-colors">
            Plan a trip
          </Link>
          {!loading && (
            user ? (
              <>
                <Link href="/trips" className="text-muted-foreground hover:text-foreground transition-colors">
                  My trips
                </Link>
                <button
                  onClick={() => signOut().then(() => router.push("/")).catch(() => router.push("/"))}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  sign out
                </button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="text-xs font-mono">
                  Sign in
                </Button>
              </Link>
            )
          )}
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
      <span className="font-black pb-[1px]" style={{ color: "var(--coral)", borderBottom: "2px solid var(--coral)" }}>
        AI
      </span>
      VEL
    </span>
  );
}
