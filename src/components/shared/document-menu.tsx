"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Download, Eye, FileDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Print / download a document in Arabic or English, and open the email composer. */
export function DocumentMenu({
  kind,
  id,
  defaultLang,
  canEmail,
  label,
}: {
  kind: "contract" | "amc" | "quotation";
  id: string;
  defaultLang: "ar" | "en";
  canEmail: boolean;
  label?: string;
}) {
  const t = useTranslations();
  const url = (lang: string, download = false) => `/api/pdf/${kind}/${id}?lang=${lang}${download ? "&download=1" : ""}`;
  const langs = [defaultLang, defaultLang === "ar" ? "en" : "ar"] as const;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileDown /> {label ?? t("documents.pdf")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {langs.map((l, i) => (
            <div key={l}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{t(`languages.${l}`)}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href={url(l)} target="_blank" rel="noreferrer">
                  <Eye /> {t("documents.print")}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={url(l, true)}>
                  <Download /> {t("documents.download")}
                </a>
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEmail && (
        <Button asChild variant="outline">
          <Link href={`/emails/compose?kind=${kind}&id=${id}`}>
            <Mail /> {t("documents.emailClient")}
          </Link>
        </Button>
      )}
    </>
  );
}
