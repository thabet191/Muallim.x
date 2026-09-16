import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * Serves the raw PDF bytes of whichever material is currently active for a
 * subject (the student's own active book, or the subject's admin default
 * otherwise) — mirrors the lookup in /api/chat so the rendered page always
 * matches what the teacher is actually reading from.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("غير مصرّح لك بذلك.", 401);
  }

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return errorResponse("subjectId مطلوب.", 400);
  }

  const userId = session.user.id;

  const studentMaterial = await prisma.studentMaterial.findFirst({
    where: { userId, subjectId, isActive: true },
    select: { fileData: true },
  });

  let fileData = studentMaterial?.fileData ?? null;
  if (!fileData) {
    const adminMaterial = await prisma.material.findFirst({
      where: { subjectId },
      orderBy: { createdAt: "desc" },
      select: { fileData: true },
    });
    fileData = adminMaterial?.fileData ?? null;
  }

  if (!fileData) {
    return errorResponse("لا يوجد ملف PDF أصلي متاح لهذه المادة.", 404);
  }

  return new Response(new Uint8Array(fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
    },
  });
}
