"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, LogOut } from "lucide-react";
import { ChangePasswordDialog } from "./change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";

export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const t = useTranslations();
  const [pwOpen, setPwOpen] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <>
    <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="grid">
          <span>{name}</span>
          <span className="text-xs font-normal text-muted-foreground" dir="ltr">
            {email}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{t(`roles.${role}`)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setPwOpen(true)}>
          <KeyRound /> {t("users.changePassword")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
          <LogOut /> {t("header.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
