export type SubjectSummary = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ProgressSummary = {
  lastTopic: string | null;
  currentLocation: string | null;
  currentPage: number | null;
  weakPoints: string[];
  lessonStatus: Record<string, string>;
};

export type StudentMaterialSummary = {
  id: string;
  title: string;
  fileName: string | null;
  pageCount: number | null;
  isActive: boolean;
  createdAt: string;
};
