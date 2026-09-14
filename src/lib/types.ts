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
  weakPoints: string[];
  lessonStatus: Record<string, string>;
};
