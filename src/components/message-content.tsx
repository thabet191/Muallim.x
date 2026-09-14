import { parseMessageParts } from "@/lib/message-content";
import { SvgBlock } from "@/components/svg-block";

function TextBlock({ text }: { text: string }) {
  // Minimal inline-bold support (**text**) without pulling in a full
  // markdown renderer — the teacher's replies are meant to be simple prose.
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <p className="whitespace-pre-wrap leading-8">
      {segments.map((segment, index) =>
        segment.startsWith("**") && segment.endsWith("**") ? (
          <strong key={index}>{segment.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{segment}</span>
        ),
      )}
    </p>
  );
}

export function MessageContent({ content }: { content: string }) {
  const parts = parseMessageParts(content);

  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, index) =>
        part.type === "svg" ? (
          <SvgBlock key={index} raw={part.value} />
        ) : part.value.trim() ? (
          <TextBlock key={index} text={part.value} />
        ) : null,
      )}
    </div>
  );
}
