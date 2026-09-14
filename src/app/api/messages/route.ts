import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
  }

  const userId = session.user.id;

  const [messages, studentMaterial] = await Promise.all([
    prisma.message.findMany({
      where: { userId, subjectId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    }),
    prisma.studentMaterial.findUnique({
      where: { userId_subjectId: { userId, subjectId } },
      select: { title: true, fileName: true, createdAt: true },
    }),
  ]);

  return Response.json({ messages, studentMaterial });
}
