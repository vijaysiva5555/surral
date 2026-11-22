import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { permsFor } from "@/lib/pageAccess";
import { getPageAccess } from "@/lib/pageAccessStore";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // what this role may do on each page (Administration → Page access): the menu, buttons and read-only modes follow it
  const perms = permsFor(await getPageAccess(), session.user.role);
  return (
    <AppShell name={session.user.name ?? "User"} role={session.user.role} perms={perms}>
      {children}
    </AppShell>
  );
}
