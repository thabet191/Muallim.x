"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressSummary, StudentMaterialSummary, SubjectSummary } from "@/lib/types";

const DEFAULT_OPTION_VALUE = "__default__";

export function SubjectPanel({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  progress,
  materialsVersion,
  onMaterialChange,
}: {
  subjects: SubjectSummary[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  progress: ProgressSummary | null;
  materialsVersion: number;
  onMaterialChange: () => void;
}) {
  const [materials, setMaterials] = useState<StudentMaterialSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
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

    setUploadNote(`تمت إضافة "${data.title}" (${data.pageCount ?? "؟"} صفحة) إلى مكتبتك.`);
    onMaterialChange();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleActivate = async (id: string | null) => {
    if (!selectedSubjectId) return;
    setSwitching(true);
    await fetch("/api/materials/student", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: selectedSubjectId, id }),
    });
    setSwitching(false);
    onMaterialChange();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/materials/student?id=${id}`, { method: "DELETE" });
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

      {progress && (progress.lastTopic || progress.currentLocation || progress.weakPoints.length > 0) && (
        <div className="rounded-lg bg-[var(--brand-soft)] p-3 text-xs leading-6">
          {progress.currentLocation && (
            <p>
              <span className="font-medium">موقعك في الكتاب: </span>
              {progress.currentLocation}
            </p>
          )}
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
        <label className="mb-1 block text-sm font-medium">مكتبة كتبك (PDF)</label>
        <p className="mb-2 text-xs text-[var(--foreground)]/60">
          ارفع كتبًا بصيغة PDF لهذه المادة، واختر أي واحد منها ليكون مصدر شرح المعلم. تُحفظ كتبك تلقائيًا ولا تحتاج لرفعها مرة أخرى.
        </p>

        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
          اختر الكتاب الذي تريد دراسته
        </label>
        <select
          value={activeMaterial?.id ?? DEFAULT_OPTION_VALUE}
          disabled={!selectedSubjectId || switching}
          onChange={(e) =>
            handleActivate(e.target.value === DEFAULT_OPTION_VALUE ? null : e.target.value)
          }
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:opacity-60"
        >
          <option value={DEFAULT_OPTION_VALUE}>المحتوى الافتراضي للمادة</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.title}
            </option>
          ))}
        </select>

        {materials.length > 0 && (
          <div className="mb-3 flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {materials.map((material) => (
              <div key={material.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="truncate">
                  {material.isActive && "✓ "}
                  {material.title}
                </span>
                <button
                  onClick={() => handleDelete(material.id)}
                  className="shrink-0 text-[var(--danger)] hover:underline"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}

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

        {uploadNote && <p className="mt-2 text-xs">{uploadNote}</p>}
      </div>
    </aside>
  );
}
