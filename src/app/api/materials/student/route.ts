import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/extract-pdf-text";

// Large textbooks can take a while to extract text from; the Vercel Hobby
// plan's default 10s function timeout is too short for that.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
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
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const subjectId = formData?.get("subjectId");
  const file = formData?.get("file");

  if (typeof subjectId !== "string" || !subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
  }
  if (!(file instanceof File)) {
    return new Response("يجب إرفاق ملف PDF.", { status: 400 });
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return new Response("الملف يجب أن يكون بصيغة PDF.", { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return new Response(`حجم الملف يتجاوز الحد المسموح (${MAX_PDF_BYTES / (1024 * 1024)} ميغابايت).`, {
      status: 400,
    });
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return new Response("المادة غير موجودة.", { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted: { text: string; pageCount: number };
  try {
    extracted = await extractPdfText(buffer);
  } catch (error) {
    console.error("pdf extraction failed", error);
    return new Response("تعذّر قراءة هذا الملف. تأكد أنه PDF سليم غير محمي بكلمة مرور.", {
      status: 422,
    });
  }

  if (!extracted.text) {
    return new Response("لم نتمكن من استخراج أي نص من هذا الملف (قد يكون صورًا ممسوحة ضوئيًا فقط).", {
      status: 422,
    });
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
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId : null;
  const id = typeof body?.id === "string" ? body.id : null;

  if (!subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
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
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("id مطلوب.", { status: 400 });
  }

  await prisma.studentMaterial.deleteMany({
    where: { id, userId: session.user.id },
  });

  return Response.json({ ok: true });
}
