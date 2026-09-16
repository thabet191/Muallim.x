"use client";

import { useEffect, useRef, useState } from "react";
import type { StudentMaterialSummary, SubjectSummary } from "@/lib/types";

// Vercel's Hobby plan hard-caps a request body around 4.5MB; warn before
// that point so a large real textbook fails with a clear reason instead of
// a confusing silent-looking error.
const SIZE_WARNING_BYTES = 4 * 1024 * 1024;

export function SubjectPanel({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  materialsVersion,
  onMaterialChange,
  onCloseMobile,
  onStartLesson,
}: {
  subjects: SubjectSummary[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  materialsVersion: number;
  onMaterialChange: () => void;
  onCloseMobile?: () => void;
  onStartLesson?: () => void;
}) {
  const [materials, setMaterials] = useState<StudentMaterialSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [uploadNote, setUploadNote] = useState<{ text: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;
  const activeMaterial = materials.find((m) => m.isActive) ?? null;

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    fetch(`/api/materials/student?subjectId=${selectedSubjectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMaterials(data?.materials ?? []);
      })
      .catch(() => {
        if (!cancelled) setMaterials([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId, materialsVersion]);

  const handleUpload = async (file: File) => {
    if (!selectedSubjectId) return;
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
      formData.append("subjectId", selectedSubjectId);
      formData.append("file", file);

      const response = await fetch("/api/materials/student", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setUploadNote({ text: data?.error ?? "تعذّر رفع الملف، حاول مجددًا.", isError: true });
        return;
      }

      setUploadNote({
        text: `تمت إضافة "${data.title}" (${data.pageCount ?? "؟"} صفحة) إلى مكتبتك، وسيبدأ المعلم الشرح منها الآن.`,
        isError: false,
      });
      onMaterialChange();
      if (fileInputRef.current) fileInputRef.current.value = "";
      // The upload just made this the active book (the server activates it
      // on creation) — start the lesson from it immediately instead of
      // leaving the student to go find and tap it in the list separately.
      onStartLesson?.();
    } catch {
      // A dropped connection or a server crash never reaches the response
      // handling above — without this the button would just go back to
      // normal with no feedback at all, and the student can't tell whether
      // the upload actually happened.
      setUploadNote({
        text: "انقطع الاتصال أثناء رفع الملف ولم يكتمل الرفع. تأكد من اتصالك بالإنترنت وحاول مجددًا.",
        isError: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: string | null) => {
    if (!selectedSubjectId) return;
    setSwitching(true);
    try {
      await fetch("/api/materials/student", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: selectedSubjectId, id }),
      });
      onMaterialChange();
    } catch {
      setUploadNote({ text: "تعذّر تفعيل الكتاب، تحقق من اتصالك وحاول مجددًا.", isError: true });
    } finally {
      setSwitching(false);
    }
  };

  // Tapping a book in the list is the obvious "open this" gesture — do both
  // steps (activate it, then have the teacher start from it) in one tap
  // instead of leaving the student to find the separate activate control
  // and the separate start button on their own.
  const handleOpenMaterial = async (id: string | null) => {
    await handleActivate(id);
    onStartLesson?.();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/materials/student?id=${id}`, { method: "DELETE" });
    onMaterialChange();
  };

  return (
    <aside className="flex w-full flex-col gap-5 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 sm:w-80">
      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="flex items-center gap-1 self-start rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm sm:hidden"
        >
          ✕ رجوع للمحادثة
        </button>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">المادة الدراسية</label>
        <select
          value={selectedSubjectId ?? ""}
          onChange={(e) => onSelectSubject(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        >
          {subjects.length === 0 && <option value="">لا توجد مواد بعد</option>}
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.nameAr}
            </option>
          ))}
        </select>
        {selectedSubject?.description && (
          <p className="mt-2 text-xs leading-6 text-[var(--foreground)]/60">
            {selectedSubject.description}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">المكتبة</label>
        <p className="mb-2 text-xs text-[var(--foreground)]/60">
          اضغط على كتاب لتبدأ دراسته. الكتب التي ترفعها تُحفظ تلقائيًا ولا تحتاج لرفعها مرة أخرى.
        </p>

        <div className="mb-3 flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          <button
            type="button"
            onClick={() => handleOpenMaterial(null)}
            disabled={!selectedSubjectId || switching}
            className="min-w-0 truncate px-2 py-1.5 text-start text-xs hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!activeMaterial && "✓ "}
            المحتوى الافتراضي للمادة
          </button>
          {materials.map((material) => (
            <div key={material.id} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleOpenMaterial(material.id)}
                disabled={switching}
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-start hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {material.isActive && "✓ "}
                {material.title}
              </button>
              <button
                onClick={() => handleDelete(material.id)}
                className="shrink-0 px-2 text-[var(--danger)] hover:underline"
              >
                حذف
              </button>
            </div>
          ))}
        </div>

        {/* Native file input kept for real functionality, visually hidden —
            its own "Choose File" button follows OS/browser locale (usually
            English) which looked broken inside an all-Arabic app. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          disabled={!selectedSubjectId || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedSubjectId || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand)] transition hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "جارٍ رفع الملف واستخراج النص..." : "+ ارفع كتابًا جديدًا (PDF)"}
        </button>

        {uploadNote && (
          <p
            role="alert"
            className={`mt-2 rounded-lg border px-3 py-2 text-xs font-medium leading-6 ${
              uploadNote.isError
                ? "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]"
                : "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-dark)]"
            }`}
          >
            {uploadNote.text}
          </p>
        )}
      </div>
    </aside>
  );
}
