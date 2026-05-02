import { Globe } from "lucide-react";
import { useI18n, type Language } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const label = lang === "ur" ? "اردو" : "EN";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["en", "ur"] as Language[]).map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLang(l)} className={lang === l ? "bg-accent" : ""}>
            {l === "en" ? t("lang.english") : t("lang.urdu")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
