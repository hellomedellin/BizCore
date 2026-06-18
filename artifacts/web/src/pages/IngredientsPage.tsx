import { ItemCatalog } from "@/components/ItemCatalog";
import { useT } from "@/lib/i18n";
import { Carrot } from "lucide-react";

export function IngredientsPage() {
  const t = useT();

  const cfg = {
    title: t("ingredient.title"),
    subtitle: t("ingredient.subtitle"),
    addLabel: t("ingredient.addLabel"),
    editLabel: "ingredient",
    icon: Carrot,
    types: ["resource"],
    createType: "resource",
    amountLabel: t("ingredient.amountLabel"),
    amountField: "cost" as const,
    amountHint: t("ingredient.amountHint"),
    emptyTitle: t("ingredient.emptyTitle"),
    emptyDesc: t("ingredient.emptyDesc"),
    namePlaceholder: t("ingredient.namePlaceholder"),
  };

  return <ItemCatalog kind="ingredient" cfg={cfg} />;
}
