import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="text-lg">{t("notFound")}</p>
      <Button asChild>
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </div>
  );
}
