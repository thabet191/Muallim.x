import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/top-nav";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const [subjects, materials, students] = await Promise.all([
    prisma.subject.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.material.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subjectId: true,
        title: true,
        fileName: true,
        pageCount: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);

  return (
    <div className="flex h-screen flex-col">
      <TopNav userName={session.user.name ?? "المشرف"} isAdmin />
      <AdminPanel
        subjects={subjects.map((s) => ({
          id: s.id,
          key: s.key,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          description: s.description,
        }))}
        materials={materials.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
        students={students.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  );
}
