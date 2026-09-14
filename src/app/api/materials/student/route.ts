import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/extract-pdf-text";

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

  const studentMaterial = await prisma.studentMaterial.upsert({
    where: { userId_subjectId: { userId: session.user.id, subjectId } },
    create: {
      userId: session.user.id,
      subjectId,
      title: file.name,
      fileName: file.name,
      sourceText: extracted.text,
      pageCount: extracted.pageCount,
    },
    update: {
      title: file.name,
      fileName: file.name,
      sourceText: extracted.text,
      pageCount: extracted.pageCount,
    },
  });

  return Response.json({
    ok: true,
    title: studentMaterial.title,
    pageCount: studentMaterial.pageCount,
    characters: extracted.text.length,
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");
  if (!subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
  }

  await prisma.studentMaterial.deleteMany({
    where: { userId: session.user.id, subjectId },
  });

  return Response.json({ ok: true });
}
