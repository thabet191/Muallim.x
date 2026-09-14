import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const subjects = await prisma.subject.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, nameAr: true, nameEn: true, description: true },
  });

  return Response.json({ subjects });
}

const createSubjectSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "استخدم حروفًا إنكليزية صغيرة وأرقامًا وشرطات فقط")
    .min(2)
    .max(40),
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return new Response("غير مصرّح لك بذلك.", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "بيانات غير صالحة.", { status: 400 });
  }

  const existing = await prisma.subject.findUnique({ where: { key: parsed.data.key } });
  if (existing) {
    return new Response("هذا المعرّف مستخدم مسبقًا.", { status: 409 });
  }

  const subject = await prisma.subject.create({ data: parsed.data });
  return Response.json({ subject });
}
