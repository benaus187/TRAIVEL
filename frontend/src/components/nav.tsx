"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CurrencySelector } from "@/components/currency-selector";

export function Nav() {
  const { user, loading, signOut } = useAuth();
  const { plan } = usePlan();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="w-full">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {pathname === "/plan" && <CurrencySelector />}
          <Link href="/plan" className="text-muted-foreground hover:text-foreground transition-colors">
            Plan a trip
          </Link>
          {!loading && (
            user ? (
              <>
                <Link href="/trips" className="text-muted-foreground hover:text-foreground transition-colors">
                  My trips
                </Link>
                {plan?.plan === "premium" ? (
                  <Link href="/pricing" className="font-mono text-xs text-vermilion">
                    Premium
                  </Link>
                ) : (
                  <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                    Upgrade
                  </Link>
                )}
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
      <span className="font-black pb-[1px] text-vermilion border-b-2 border-vermilion">
        AI
      </span>
      VEL
    </span>
  );
}
