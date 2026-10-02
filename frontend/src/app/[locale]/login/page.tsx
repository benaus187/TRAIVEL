"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const t = useTranslations("login");
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20 space-y-8">
      <div className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Google OAuth */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signInWithGoogle()}
      >
        {t("google")}
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-mono text-muted-foreground">{t("or")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Magic link */}
      {sent ? (
        <div className="p-4 rounded-md bg-muted text-sm text-center space-y-1">
          <p className="font-medium">{t("sentTitle")}</p>
          <p className="text-muted-foreground">
            {t.rich("sentBody", { email, b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3">
          <input
            type="email"
            required
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("sending") : t("sendMagicLink")}
          </Button>
        </form>
      )}

      <button
        onClick={() => router.back()}
        className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("back")}
      </button>
    </div>
  );
}
