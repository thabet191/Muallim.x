"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "تعذّر إنشاء الحساب. حاول مجددًا.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("تم إنشاء الحساب، لكن تعذّر تسجيل الدخول تلقائيًا. جرّب صفحة الدخول.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-[var(--brand-dark)]">المعلم X</h1>
        <p className="mb-6 text-sm text-[var(--foreground)]/70">أنشئ حسابك لتبدأ رحلتك التعليمية</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            الاسم
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--brand)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            البريد الإلكتروني
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--brand)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            كلمة المرور
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:border-[var(--brand)]"
            />
            <span className="text-xs text-[var(--foreground)]/50">8 أحرف على الأقل</span>
          </label>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-[var(--brand)] px-4 py-2 font-medium text-white transition hover:bg-[var(--brand-dark)] disabled:opacity-60"
          >
            {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--foreground)]/70">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-[var(--brand)] hover:underline">
            سجّل دخولك
          </Link>
        </p>
      </div>
    </main>
  );
}
