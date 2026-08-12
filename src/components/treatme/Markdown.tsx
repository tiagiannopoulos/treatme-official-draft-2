import type { ReactNode } from "react";

/** tiny markdown renderer: headings, paragraphs, bullets, bold and links */
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else if (match[2] && match[3]) {
      nodes.push(
        <a key={`${keyBase}-a${i}`} href={match[3]} className="underline">
          {match[2]}
        </a>,
      );
    }
    last = match.index + match[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocks = source.trim().split(/\n{2,}/);

  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, index) => {
        const key = `md-${index}`;
        const lines = block.split("\n");

        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={key} className="list-disc pl-5 space-y-1.5">
              {lines.map((line, li) => (
                <li key={`${key}-${li}`} className="text-[14px] leading-relaxed text-ink-mute">
                  {inline(line.replace(/^\s*[-*]\s+/, ""), `${key}-${li}`)}
                </li>
              ))}
            </ul>
          );
        }

        const heading = /^(#{1,4})\s+(.*)$/.exec(block);
        if (heading) {
          const level = heading[1].length;
          const text = heading[2];
          if (level === 1) {
            return (
              <h2 key={key} className="brand-display text-[24px] lowercase pt-2">
                {text}
              </h2>
            );
          }
          return (
            <h3 key={key} className="font-semibold text-[15px] lowercase pt-2">
              {text}
            </h3>
          );
        }

        return (
          <p key={key} className="text-[14px] leading-relaxed text-ink-mute">
            {inline(block.replace(/\n/g, " "), key)}
          </p>
        );
      })}
    </div>
  );
}
