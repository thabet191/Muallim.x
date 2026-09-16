"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

// Vercel's Hobby plan hard-caps a request body around 4.5MB; warn before
// that point so a large real textbook fails with a clear reason instead of
// a confusing silent-looking error.
const SIZE_WARNING_BYTES = 4 * 1024 * 1024;

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
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showStudents, setShowStudents] = useState(false);

  const [uploadSubjectId, setUploadSubjectId] = useState(subjects[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<{ text: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubjectError(null);
    setCreatingSubject(true);

    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSubject),
    });
    const data = await response.json().catch(() => null);

    setCreatingSubject(false);
    if (!response.ok) {
      setSubjectError(data?.error ?? "تعذّر إضافة المادة.");
      return;
    }

    setNewSubject({ key: "", nameAr: "", nameEn: "", description: "" });
    setShowAddSubject(false);
    router.refresh();
  };

  const handleUploadMaterial = async (file: File) => {
    if (!uploadSubjectId) return;
    setUploadNote(null);

    if (file.size > SIZE_WARNING_BYTES) {
      setUploadNote({
        text: `حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)} ميغابايت) كبير وقد يفشل رفعه على هذه الاستضافة. جرّب ضغط الملف بأداة مجانية لتصغير حجمه إلى أقل من 4 ميغابايت ثم أعد المحاولة.`,
        isError: true,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("subjectId", uploadSubjectId);
      formData.append("file", file);

      const response = await fetch("/api/materials/admin", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setUploadNote({ text: data?.error ?? "تعذّر رفع الملف.", isError: true });
        return;
      }

      setUploadNote({ text: `تمت إضافة "${data.title}" إلى مكتبة هذه المادة.`, isError: false });
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      // A dropped connection or a server crash never reaches the response
      // handling above — without this the button would just go back to
      // normal with no feedback at all, and it looks like the upload
      // silently vanished.
      setUploadNote({
        text: "انقطع الاتصال أثناء رفع الملف ولم يكتمل الرفع. تأكد من اتصالك بالإنترنت وحاول مجددًا.",
        isError: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    await fetch(`/api/materials/admin?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-4 py-8">
      <h1 className="text-xl font-bold text-[var(--brand-dark)]">لوحة تحكم المعلم/المطور</h1>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="mb-1 block text-sm font-medium">المادة</label>
        <select
          value={uploadSubjectId}
          onChange={(e) => setUploadSubjectId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr}
            </option>
          ))}
        </select>

        <div className="mb-4 flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {materials.filter((m) => m.subjectId === uploadSubjectId).length === 0 && (
            <p className="px-3 py-3 text-sm text-[var(--foreground)]/60">
              لا توجد كتب في مكتبة هذه المادة بعد.
            </p>
          )}
          {materials
            .filter((m) => m.subjectId === uploadSubjectId)
            .map((material) => (
              <div key={material.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{material.title}</span>
                <button
                  onClick={() => handleDeleteMaterial(material.id)}
                  className="shrink-0 text-xs text-[var(--danger)] hover:underline"
                >
                  حذف
                </button>
              </div>
            ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          disabled={!uploadSubjectId || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadMaterial(file);
          }}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!uploadSubjectId || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand)] transition hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "جارٍ رفع الملف واستخراج النص..." : "+ ارفع كتابًا جديدًا (PDF)"}
        </button>

        {uploadNote && (
          <p
            role="alert"
            className={`mt-2 rounded-lg border px-3 py-2 text-sm font-medium leading-6 ${
              uploadNote.isError
                ? "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]"
                : "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-dark)]"
            }`}
          >
            {uploadNote.text}
          </p>
        )}
      </section>

      <button
        onClick={() => setShowAddSubject((v) => !v)}
        className="self-start text-sm text-[var(--brand)] hover:underline"
      >
        {showAddSubject ? "− إخفاء" : "+ إضافة مادة جديدة إلى القائمة"}
      </button>

      {showAddSubject && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
      )}

      <button
        onClick={() => setShowStudents((v) => !v)}
        className="self-start text-sm text-[var(--brand)] hover:underline"
      >
        {showStudents ? "− إخفاء" : `👥 الطلاب المسجّلون (${students.length})`}
      </button>

      {showStudents && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
      )}
    </div>
  );
}
