import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { PAGES, canSeePage } from "@/lib/pageAccess";
import { getPageAccess } from "@/lib/pageAccessStore";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // the pages this role may open (Administration → Page access) – the menu shows only these
  const access = await getPageAccess();
  const pages = PAGES.filter((p) => canSeePage(access, session.user.role, p.key)).map((p) => p.key);
  return (
    <AppShell name={session.user.name ?? "User"} role={session.user.role} pages={pages}>
      {children}
    </AppShell>
  );
}
