import { AutoGrowTextarea, Input } from "@/components/ui/input";
import { applyMention, mentionFragment } from "@/lib/ops/mentions";
import { cn } from "@/lib/utils";

export function MentionField({
  value,
  onChange,
  teammates,
  multiline,
  placeholder,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  teammates: { username: string }[];
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const fragment = mentionFragment(value);
  const suggestions =
    fragment != null
      ? teammates
          .filter((t) => t.username.toLowerCase().includes(fragment.toLowerCase()))
          .slice(0, 8)
      : [];

  function pick(username: string) {
    onChange(applyMention(value, username));
  }

  return (
    <div className="relative">
      {multiline ? (
        <AutoGrowTextarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      )}
      {suggestions.length ? (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover py-1 shadow-soft">
          {suggestions.map((t) => (
            <li key={t.username}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(t.username);
                }}
              >
                <span className="font-medium">@{t.username}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MentionBody({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9._-]{2,32})/g);
  return (
    <p className="mt-1 text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-medium text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
