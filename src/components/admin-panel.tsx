"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubjectSummary } from "@/lib/types";

type Material = {
  id: string;
  subjectId: string;
  title: string;
  fileName: string | null;
  pageCount: number | null;
  createdAt: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export function AdminPanel({
  subjects,
  materials,
  students,
}: {
  subjects: SubjectSummary[];
  materials: Material[];
  students: Student[];
}) {
  const router = useRouter();

  const [newSubject, setNewSubject] = useState({ key: "", nameAr: "", nameEn: "", description: "" });
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [creatingSubject, setCreatingSubject] = useState(false);

  const [uploadSubjectId, setUploadSubjectId] = useState(subjects[0]?.id ?? "");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const handleCreateSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubjectError(null);
    setCreatingSubject(true);

    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSubject),
    });

    setCreatingSubject(false);
    if (!response.ok) {
      setSubjectError(await response.text());
      return;
    }

    setNewSubject({ key: "", nameAr: "", nameEn: "", description: "" });
    router.refresh();
  };

  const handleUploadMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file || !uploadSubjectId) return;

    setUploading(true);
    setUploadNote(null);

    const formData = new FormData();
    formData.append("subjectId", uploadSubjectId);
    formData.append("file", file);
    if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());

    const response = await fetch("/api/materials/admin", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);

    setUploading(false);
    if (!response.ok) {
      setUploadNote(typeof data === "string" ? data : "تعذّر رفع الملف.");
      return;
    }

    setUploadNote(`تم حفظ "${data.title}" كمصدر دائم لهذه المادة.`);
    setUploadTitle("");
    fileInput.value = "";
    router.refresh();
  };

  const handleDeleteMaterial = async (id: string) => {
    await fetch(`/api/materials/admin?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 overflow-y-auto px-4 py-8">
      <h1 className="text-xl font-bold text-[var(--brand-dark)]">لوحة تحكم المعلم/المطور</h1>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">إضافة مادة جديدة</h2>
        <form onSubmit={handleCreateSubject} className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="معرّف فريد (بالإنكليزية، مثل physics)"
            value={newSubject.key}
            onChange={(e) => setNewSubject((s) => ({ ...s, key: e.target.value }))}
            required
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            placeholder="الاسم بالعربية"
            value={newSubject.nameAr}
            onChange={(e) => setNewSubject((s) => ({ ...s, nameAr: e.target.value }))}
            required
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            placeholder="الاسم بالإنكليزية"
            value={newSubject.nameEn}
            onChange={(e) => setNewSubject((s) => ({ ...s, nameEn: e.target.value }))}
            required
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            placeholder="وصف مختصر (اختياري)"
            value={newSubject.description}
            onChange={(e) => setNewSubject((s) => ({ ...s, description: e.target.value }))}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          {subjectError && <p className="sm:col-span-2 text-sm text-[var(--danger)]">{subjectError}</p>}
          <button
            type="submit"
            disabled={creatingSubject}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60 sm:col-span-2"
          >
            {creatingSubject ? "جارٍ الإضافة..." : "إضافة المادة"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">المصدر الدائم لكل مادة (يظهر لكل الطلاب)</h2>
        <form onSubmit={handleUploadMaterial} className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={uploadSubjectId}
            onChange={(e) => setUploadSubjectId(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <input
            placeholder="عنوان (اختياري)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input name="file" type="file" accept="application/pdf" required className="text-sm" />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
          >
            {uploading ? "جارٍ الرفع..." : "رفع"}
          </button>
        </form>
        {uploadNote && <p className="mb-3 text-sm">{uploadNote}</p>}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {materials.length === 0 && (
            <p className="py-3 text-sm text-[var(--foreground)]/60">لا توجد مصادر مرفوعة بعد.</p>
          )}
          {materials.map((material) => {
            const subject = subjects.find((s) => s.id === material.subjectId);
            return (
              <div key={material.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{material.title}</p>
                  <p className="text-xs text-[var(--foreground)]/60">
                    {subject?.nameAr ?? "—"} · {material.pageCount ?? "؟"} صفحة
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteMaterial(material.id)}
                  className="shrink-0 text-xs text-[var(--danger)] hover:underline"
                >
                  حذف
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 font-semibold">الطلاب المسجّلون ({students.length})</h2>
        <div className="flex flex-col divide-y divide-[var(--border)] text-sm">
          {students.length === 0 && (
            <p className="py-3 text-[var(--foreground)]/60">لا يوجد طلاب مسجّلون بعد.</p>
          )}
          {students.map((student) => (
            <div key={student.id} className="flex items-center justify-between py-2">
              <span>{student.name}</span>
              <span className="text-xs text-[var(--foreground)]/60">{student.email}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
