"use client";

import { useRef, useState } from "react";
import type { ProgressSummary, SubjectSummary } from "@/lib/types";

export function SubjectPanel({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  progress,
  studentMaterial,
  onMaterialChange,
}: {
  subjects: SubjectSummary[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  progress: ProgressSummary | null;
  studentMaterial: { title: string; fileName: string | null } | null;
  onMaterialChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;

  const handleUpload = async (file: File) => {
    if (!selectedSubjectId) return;
    setUploading(true);
    setUploadNote(null);

    const formData = new FormData();
    formData.append("subjectId", selectedSubjectId);
    formData.append("file", file);

    const response = await fetch("/api/materials/student", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);

    setUploading(false);
    if (!response.ok) {
      setUploadNote(typeof data === "string" ? data : "تعذّر رفع الملف، حاول مجددًا.");
      return;
    }

    setUploadNote(`تم رفع "${data.title}" (${data.pageCount ?? "؟"} صفحة) بنجاح.`);
    onMaterialChange();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveMaterial = async () => {
    if (!selectedSubjectId) return;
    await fetch(`/api/materials/student?subjectId=${selectedSubjectId}`, { method: "DELETE" });
    setUploadNote(null);
    onMaterialChange();
  };

  return (
    <aside className="flex w-full flex-col gap-5 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 sm:w-80">
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

      {progress && (progress.lastTopic || progress.weakPoints.length > 0) && (
        <div className="rounded-lg bg-[var(--brand-soft)] p-3 text-xs leading-6">
          {progress.lastTopic && (
            <p>
              <span className="font-medium">آخر موضوع: </span>
              {progress.lastTopic}
            </p>
          )}
          {progress.weakPoints.length > 0 && (
            <p>
              <span className="font-medium">نقاط للمراجعة: </span>
              {progress.weakPoints.join("، ")}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">كتابك الخاص (PDF)</label>
        <p className="mb-2 text-xs text-[var(--foreground)]/60">
          ارفع ملف PDF ليحل محل المحتوى الافتراضي لهذه المادة. يُحفظ تلقائيًا ولا تحتاج لرفعه مرة أخرى.
        </p>

        {studentMaterial ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs">
            <span className="truncate">{studentMaterial.title}</span>
            <button
              onClick={handleRemoveMaterial}
              className="shrink-0 text-[var(--danger)] hover:underline"
            >
              إزالة
            </button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          disabled={!selectedSubjectId || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          className="block w-full text-xs file:me-2 file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-3 file:py-1.5 file:text-white hover:file:bg-[var(--brand-dark)]"
        />
        {uploading && <p className="mt-2 text-xs text-[var(--foreground)]/60">جارٍ رفع الملف واستخراج النص...</p>}
        {uploadNote && <p className="mt-2 text-xs">{uploadNote}</p>}
      </div>
    </aside>
  );
}
