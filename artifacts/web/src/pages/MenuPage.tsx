import { ItemCatalog } from "@/components/ItemCatalog";
import { useT } from "@/lib/i18n";
import { UtensilsCrossed } from "lucide-react";

export function MenuPage() {
  const t = useT();

  const cfg = {
    title: t("menu.title"),
    subtitle: t("menu.subtitle"),
    addLabel: t("menu.addLabel"),
    editLabel: "menu item",
    icon: UtensilsCrossed,
    types: ["product", "service", "bundle"],
    createType: "product",
    amountLabel: t("menu.amountLabel"),
    amountField: "basePrice" as const,
    amountHint: t("menu.amountHint"),
    emptyTitle: t("menu.emptyTitle"),
    emptyDesc: t("menu.emptyDesc"),
    namePlaceholder: t("menu.namePlaceholder"),
  };

  return <ItemCatalog kind="menu" cfg={cfg} />;
}
