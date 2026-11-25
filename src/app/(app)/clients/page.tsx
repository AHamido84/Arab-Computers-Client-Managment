import { ComingSoon } from "@/components/shared/coming-soon";
import { requireUser } from "@/server/auth-guard";

export default async function Page() {
  await requireUser();
  return <ComingSoon navKey="clients" />;
}
