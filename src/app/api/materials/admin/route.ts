import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/extract-pdf-text";
import { errorResponse } from "@/lib/api-error";

// Large textbooks can take a while to extract text from; the Vercel Hobby
// plan's default 10s function timeout is too short for that.
export const maxDuration = 60;
// This list changes on every upload/delete and must never be cached.
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return errorResponse("غير مصرّح لك بذلك.", 403);

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  const materials = await prisma.material.findMany({
    where: subjectId ? { subjectId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subjectId: true,
      title: true,
      fileName: true,
      pageCount: true,
      createdAt: true,
      subject: { select: { nameAr: true } },
    },
  });

  return Response.json({ materials });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return errorResponse("غير مصرّح لك بذلك.", 403);

  const formData = await request.formData().catch(() => null);
  const subjectId = formData?.get("subjectId");
  const file = formData?.get("file");
  const title = formData?.get("title");

  if (typeof subjectId !== "string" || !subjectId) {
    return errorResponse("subjectId مطلوب.", 400);
  }
  if (!(file instanceof File)) {
    return errorResponse("يجب إرفاق ملف PDF.", 400);
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
    return errorResponse("لم نتمكن من استخراج أي نص من هذا الملف.", 422);
  }

  const material = await prisma.material.create({
    data: {
      subjectId,
      title: typeof title === "string" && title.trim() ? title.trim() : file.name,
      fileName: file.name,
      sourceText: extracted.text,
      pageCount: extracted.pageCount,
      uploadedById: session.user.id,
    },
  });

  return Response.json({
    ok: true,
    id: material.id,
    title: material.title,
    pageCount: material.pageCount,
    characters: extracted.text.length,
  });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return errorResponse("غير مصرّح لك بذلك.", 403);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return errorResponse("id مطلوب.", 400);

  await prisma.material.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
