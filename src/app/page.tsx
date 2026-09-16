import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/top-nav";
import { ChatApp } from "@/components/chat-app";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const subjects = await prisma.subject.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, nameAr: true, nameEn: true, description: true },
  });

  return (
    <div className="flex h-screen flex-col">
      <TopNav userName={session.user.name ?? "طالبنا"} />
      <ChatApp subjects={subjects} />
    </div>
  );
}
