import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صالحة. تأكد من الاسم والبريد وكلمة مرور من 8 أحرف على الأقل." },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "هذا البريد الإلكتروني مسجّل مسبقًا." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Bootstrap: the very first account in the system becomes an admin so
  // there is always someone who can open the materials admin panel.
  const isFirstUser = (await prisma.user.count()) === 0;

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: isFirstUser ? "ADMIN" : "STUDENT",
    },
  });

  return NextResponse.json({ ok: true });
}
