import { useEffect, useRef, useState } from "react";

/**
 * Text that answers each key on the page at once and reaches the address bar once typing pauses, so the address
 * bar isn't rewritten per key. When the address bar changes under it (Back, Clear filters), it shows that.
 */
export function usePausedValue(value: string, onChange: (v: string) => void, delay = 300): [string, (v: string) => void] {
  const [text, setText] = useState(value);
  const sent = useRef(value);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    // The page trims what it keeps: "abc " typed and "abc" kept are the same text.
    if (value.trim() !== sent.current.trim()) {
      sent.current = value;
      setText(value);
    }
  }, [value]);
  useEffect(() => {
    if (text === sent.current) return;
    const t = setTimeout(() => {
      sent.current = text;
      latest.current(text);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return [text, setText];
}
