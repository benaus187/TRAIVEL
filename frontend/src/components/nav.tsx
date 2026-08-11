"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencySelector } from "@/components/currency-selector";
import { cn } from "@/lib/utils";

function initials(label: string): string {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export function Nav() {
  const { user, loading, signOut } = useAuth();
  const { plan } = usePlan();
  const router = useRouter();
  const pathname = usePathname();

  const displayName: string =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const isPremium = plan?.plan === "premium";

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
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Avatar className="size-7">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                    <AvatarFallback>{initials(displayName)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <div className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground truncate max-w-52">
                    {displayName}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/trips" />}>
                    My trips
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/pricing" />}>
                    {isPremium ? (
                      <span className="text-vermilion">Premium</span>
                    ) : (
                      "Upgrade"
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut().then(() => router.push("/")).catch(() => router.push("/"))}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

export function Wordmark({ className }: { className?: string } = {}) {
  return (
    <span className={cn("font-semibold text-lg tracking-tight select-none", className)}>
      TR
      <span className="font-black pb-[1px] text-vermilion border-b-2 border-vermilion">
        AI
      </span>
      VEL
    </span>
  );
}
