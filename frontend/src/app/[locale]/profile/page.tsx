"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/language-switcher";

type ProfileRow = {
  display_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
};

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const { user, loading, supabase } = useAuth();
  const router = useRouter();

  const [fetching, setFetching] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("users")
      .select("display_name, phone, date_of_birth")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: ProfileRow | null }) => {
        setDisplayName(data?.display_name ?? "");
        setPhone(data?.phone ?? "");
        setDateOfBirth(data?.date_of_birth ?? "");
        setFetching(false);
      });
  }, [user, supabase]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from("users")
      .update({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
      })
      .eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-mono">
        {tCommon("loadingLower")}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-md mx-auto px-6 py-10 space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
          {t("eyebrow")}
        </p>
        <h1 className="text-xl font-bold">{t("title")}</h1>
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">{t("nameLabel")}</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">{t("emailLabel")}</label>
            <Input value={user.email ?? ""} disabled />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">{t("phoneLabel")}</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">{t("dobLabel")}</label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">{t("languageLabel")}</label>
            <div>
              <LanguageSwitcher />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : t("save")}
            </Button>
            {saved && (
              <span className="font-mono text-xs text-[#1f7a45]">{t("saved")}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
