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

  const progress = await prisma.progress.findUnique({
    where: { userId_subjectId: { userId: session.user.id, subjectId } },
  });

  return Response.json({
    lastTopic: progress?.lastTopic ?? null,
    weakPoints: progress?.weakPoints ? JSON.parse(progress.weakPoints) : [],
    lessonStatus: progress?.lessonStatus ? JSON.parse(progress.lessonStatus) : {},
  });
}
