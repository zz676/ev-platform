import { getTranslations } from "next-intl/server";
import { UnderConstruction } from "@/components/ui/UnderConstruction";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("UnderConstruction");

  return (
    <UnderConstruction
      message={t("message")}
      backText={t("backToNews")}
      locale={locale}
    />
  );
}
