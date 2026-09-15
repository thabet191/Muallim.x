import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/extract-pdf-text";
import { errorResponse } from "@/lib/api-error";

// Large textbooks can take a while to extract text from; the Vercel Hobby
// plan's default 10s function timeout is too short for that.
export const maxDuration = 60;
// This list changes on every upload/delete and must never be cached.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("غير مصرّح لك بذلك.", 401);
  }

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return errorResponse("subjectId مطلوب.", 400);
  }

  const materials = await prisma.studentMaterial.findMany({
    where: { userId: session.user.id, subjectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, fileName: true, pageCount: true, isActive: true, createdAt: true },
  });

  return Response.json({ materials });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("غير مصرّح لك بذلك.", 401);
  }

  const formData = await request.formData().catch(() => null);
  const subjectId = formData?.get("subjectId");
  const file = formData?.get("file");

  if (typeof subjectId !== "string" || !subjectId) {
    return errorResponse("subjectId مطلوب.", 400);
  }
  if (!(file instanceof File)) {
    return errorResponse("يجب إرفاق ملف PDF.", 400);
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return errorResponse("الملف يجب أن يكون بصيغة PDF.", 400);
  }
  if (file.size > MAX_PDF_BYTES) {
    return errorResponse(
      `حجم الملف يتجاوز الحد المسموح (${MAX_PDF_BYTES / (1024 * 1024)} ميغابايت).`,
      400,
    );
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return errorResponse("المادة غير موجودة.", 404);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted: { text: string; pageCount: number };
  try {
    extracted = await extractPdfText(buffer);
  } catch (error) {
    console.error("pdf extraction failed", error);
    return errorResponse("تعذّر قراءة هذا الملف. تأكد أنه PDF سليم غير محمي بكلمة مرور.", 422);
  }

  if (!extracted.text) {
    return errorResponse(
      "لم نتمكن من استخراج أي نص من هذا الملف (قد يكون صورًا ممسوحة ضوئيًا فقط).",
      422,
    );
  }

  const userId = session.user.id;

  const studentMaterial = await prisma.$transaction(async (tx) => {
    await tx.studentMaterial.updateMany({
      where: { userId, subjectId },
      data: { isActive: false },
    });
    return tx.studentMaterial.create({
      data: {
        userId,
        subjectId,
        title: file.name,
        fileName: file.name,
        sourceText: extracted.text,
        pageCount: extracted.pageCount,
        isActive: true,
      },
    });
  });

  return Response.json({
    ok: true,
    id: studentMaterial.id,
    title: studentMaterial.title,
    pageCount: studentMaterial.pageCount,
    characters: extracted.text.length,
  });
}

/** Switches which uploaded book is active for a subject, or clears back to the subject's default content when id is null. */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("غير مصرّح لك بذلك.", 401);
  }

  const body = await request.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId : null;
  const id = typeof body?.id === "string" ? body.id : null;

  if (!subjectId) {
    return errorResponse("subjectId مطلوب.", 400);
  }

  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.studentMaterial.updateMany({
      where: { userId, subjectId },
      data: { isActive: false },
    });
    if (id) {
      await tx.studentMaterial.updateMany({
        where: { id, userId, subjectId },
        data: { isActive: true },
      });
    }
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("غير مصرّح لك بذلك.", 401);
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return errorResponse("id مطلوب.", 400);
  }

  await prisma.studentMaterial.deleteMany({
    where: { id, userId: session.user.id },
  });

  return Response.json({ ok: true });
}
