import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { anthropic, TEACHER_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt, UPDATE_PROGRESS_TOOL, type ProgressState } from "@/lib/teacher-prompt";

// Vercel's default serverless function timeout (10s on the Hobby plan) is
// too short for a full streamed teacher reply; raise it explicitly. 60s is
// the max the Hobby plan allows and is available on every paid plan too.
export const maxDuration = 60;

const MAX_MATERIAL_CHARS = 60_000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 4_000;

const KICKOFF_INSTRUCTION =
  "[بداية الجلسة - تعليمة نظام لا تُعرض للطالب] افتح الجلسة الآن بنفسك: رحّب بالطالب باسمه، وإن كان قد درس معك من قبل ذكّره بلطف بآخر موضوع توقفتما عنده قبل أن تكمل، ثم اطرح سؤالك التشخيصي المعتاد عن المفهوم السابق قبل أي شرح جديد.";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("غير مصرّح لك بذلك.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const subjectId = typeof body?.subjectId === "string" ? body.subjectId : null;
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";

  if (!subjectId) {
    return new Response("subjectId مطلوب.", { status: 400 });
  }
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    return new Response("الرسالة طويلة جدًا.", { status: 400 });
  }

  const userId = session.user.id;

  const [subject, user, progressRow, studentMaterial] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.progress.findUnique({ where: { userId_subjectId: { userId, subjectId } } }),
    prisma.studentMaterial.findFirst({ where: { userId, subjectId, isActive: true } }),
  ]);

  if (!subject || !user) {
    return new Response("المادة أو المستخدم غير موجود.", { status: 404 });
  }

  let materialText: string | null = studentMaterial?.sourceText ?? null;
  if (!materialText) {
    const adminMaterial = await prisma.material.findFirst({
      where: { subjectId },
      orderBy: { createdAt: "desc" },
    });
    materialText = adminMaterial?.sourceText ?? null;
  }
  if (materialText && materialText.length > MAX_MATERIAL_CHARS) {
    materialText = `${materialText.slice(0, MAX_MATERIAL_CHARS)}\n\n[...تم اقتطاع بقية النص لطوله، اعتمد على ما سبق ومعرفتك العامة لإكمال الشرح...]`;
  }

  const historyRows = await prisma.message.findMany({
    where: { userId, subjectId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
  });
  historyRows.reverse();

  const progress: ProgressState = {
    lastTopic: progressRow?.lastTopic ?? null,
    currentLocation: progressRow?.currentLocation ?? null,
    currentPage: progressRow?.currentPage ?? null,
    weakPoints: progressRow?.weakPoints ? JSON.parse(progressRow.weakPoints) : [],
    lessonStatus: progressRow?.lessonStatus ? JSON.parse(progressRow.lessonStatus) : {},
  };

  const isKickoff = rawMessage.length === 0;
  const lastStoredRole = historyRows.at(-1)?.role;

  const systemPrompt = buildSystemPrompt({
    studentName: user.name,
    subjectNameAr: subject.nameAr,
    materialText,
    progress,
    isFirstEverSession: historyRows.length === 0,
  });

  const anthropicMessages: Anthropic.MessageParam[] = historyRows.map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
  }));

  if (isKickoff) {
    // Guard against a dangling unanswered user turn (e.g. a previous request
    // crashed mid-stream): don't push a second consecutive user message,
    // Anthropic's API requires strict user/assistant alternation.
    if (lastStoredRole !== "user") {
      anthropicMessages.push({ role: "user", content: KICKOFF_INSTRUCTION });
    }
  } else {
    anthropicMessages.push({ role: "user", content: rawMessage });
    await prisma.message.create({
      data: { userId, subjectId, role: "user", content: rawMessage },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let finalMessage: Anthropic.Message | null = null;

      const anthropicStream = anthropic.messages.stream({
        model: TEACHER_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools: [UPDATE_PROGRESS_TOOL],
        messages: anthropicMessages,
      });

      // If the student hits "stop" and the client aborts the fetch, cancel
      // the upstream call too instead of paying for tokens nobody reads.
      const onClientAbort = () => anthropicStream.abort();
      request.signal.addEventListener("abort", onClientAbort);

      anthropicStream.on("text", (delta) => {
        fullText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      try {
        finalMessage = await anthropicStream.finalMessage();
      } catch (error) {
        console.error("chat stream error", error);
        if (fullText.length === 0) {
          controller.enqueue(
            encoder.encode("عذرًا، حدث خطأ أثناء الاتصال بالمعلم. حاول مرة أخرى بعد قليل."),
          );
        }
      } finally {
        request.signal.removeEventListener("abort", onClientAbort);
      }

      try {
        // Persist whatever text streamed even if the call was interrupted
        // (stopped by the student) or errored partway — otherwise the next
        // turn's history ends on a dangling user message and breaks the
        // strict user/assistant alternation the API requires.
        if (fullText.trim().length > 0) {
          await prisma.message.create({
            data: { userId, subjectId, role: "assistant", content: fullText },
          });
        }

        const toolUse = finalMessage?.content.find(
          (block): block is Anthropic.ToolUseBlock =>
            block.type === "tool_use" && block.name === "update_progress",
        );

        if (toolUse && toolUse.input && typeof toolUse.input === "object") {
          const input = toolUse.input as {
            lastTopic?: string;
            currentLocation?: string;
            currentPage?: number;
            weakPoints?: string[];
            lessonStatus?: Record<string, string>;
          };

          await prisma.progress.upsert({
            where: { userId_subjectId: { userId, subjectId } },
            create: {
              userId,
              subjectId,
              lastTopic: input.lastTopic ?? null,
              currentLocation: input.currentLocation ?? null,
              currentPage: input.currentPage ?? null,
              weakPoints: JSON.stringify(input.weakPoints ?? []),
              lessonStatus: JSON.stringify(input.lessonStatus ?? {}),
            },
            update: {
              lastTopic: input.lastTopic ?? progress.lastTopic,
              currentLocation: input.currentLocation ?? progress.currentLocation,
              currentPage: input.currentPage ?? progress.currentPage,
              weakPoints: JSON.stringify(input.weakPoints ?? progress.weakPoints),
              lessonStatus: JSON.stringify(input.lessonStatus ?? progress.lessonStatus),
            },
          });
        }
      } catch (error) {
        console.error("chat post-stream persistence error", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
