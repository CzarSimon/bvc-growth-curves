import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getChild, getMyRole, listChildren } from "@/lib/db";
import { ageDays } from "@/lib/child-data";
import { canEdit } from "@/lib/access";
import { todayIso } from "@/lib/format";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const [child, all, myRole] = await Promise.all([
    getChild(childId),
    listChildren(),
    getMyRole(childId),
  ]);
  if (!child) notFound();

  const today = todayIso();
  const summaries = all.map((entry) => ({ ...entry, ageDays: ageDays(entry, today) }));
  const active = summaries.find((entry) => entry.id === child.id) ?? {
    ...child,
    ageDays: ageDays(child, today),
  };

  return (
    <AppShell child={active} childList={summaries} canEdit={canEdit(myRole)}>
      {children}
    </AppShell>
  );
}
