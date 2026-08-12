import Link from "next/link";
import { Fragment } from "react";
import { isSafeExternalUrl } from "@/lib/utils";

/**
 * Render post/comment text with #hashtags, @mentions and URLs as links.
 * Pure server-safe component. XSS-safe: we escape everything by splitting
 * the string and only rendering known-safe tokens as elements.
 */
export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(/(\s+)/); // keep whitespace so wrapping works
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part) || part === "") return <Fragment key={i}>{part}</Fragment>;

        // Hashtag
        const hashtag = part.match(/^#([a-zA-Z0-9_]+)$/);
        if (hashtag) {
          return (
            <Link
              key={i}
              href={`/discover?tag=${encodeURIComponent(hashtag[1].toLowerCase())}`}
              className="font-medium text-brand hover:underline"
            >
              {part}
            </Link>
          );
        }

        // Mention
        const mention = part.match(/^@([a-zA-Z][a-zA-Z0-9_]{2,19})$/);
        if (mention) {
          return (
            <Link
              key={i}
              href={`/profile/${encodeURIComponent(mention[1])}`}
              className="font-medium text-brand hover:underline"
            >
              {part}
            </Link>
          );
        }

        // URL
        if (/^https?:\/\//.test(part) && isSafeExternalUrl(part)) {
          const label = part.length > 40 ? `${part.slice(0, 40)}…` : part;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-brand-2 hover:underline break-all"
            >
              {label}
            </a>
          );
        }

        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
