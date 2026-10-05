import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  explainTroubleshoot,
  runTroubleshoot,
  saveLibraryFileText,
  saveTroubleshootFix,
  troubleshootSources,
  type TsCite,
  type TsExplain,
  type TsFix,
  type TsLine,
  type TsResult,
  type TsSource,
} from "@/lib/ops/troubleshoot";
import { fileUrl } from "@/lib/ops/library-file-rules";
import { MAX_MANUAL_BYTES, pdfPageTexts } from "@/lib/pdf-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
/** Opens the stored PDF at the cited page. */
const citeUrl = (c: TsCite) => `${fileUrl(origin(), c.token)}#page=${c.page}`;

/**
 * Read one stored PDF in the browser and keep its text page by page. Done once per file.
 * A file with no text layer (a scan), a Word file or a picture is recorded as unreadable — never guessed around.
 */
async function readSource(src: TsSource, onStep: (text: string) => void): Promise<number> {
  const none = async () => (await saveLibraryFileText({ data: { fileId: src.id, pages: [], totalPages: 0 } })).textPages ?? 0;
  if (src.mime !== "application/pdf") return none();
  const res = await fetch(fileUrl(origin(), src.token));
  if (!res.ok) throw new Error(`${src.label} could not be opened.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_MANUAL_BYTES) return none();
  let texts: string[];
  try {
    texts = await pdfPageTexts(bytes, (done, total) => onStep(`Reading ${src.label}… page ${done} of ${total}`));
  } catch {
    return none();
  }
  const pages = texts.map((text, i) => ({ page: i + 1, text: text.slice(0, 40_000) })).filter((p) => p.text.trim());
  // Sent in small batches so each request stays well under the host's size limit.
  let batch: typeof pages = [];
  let size = 0;
  const flush = async () => {
    if (batch.length) await saveLibraryFileText({ data: { fileId: src.id, pages: batch } });
    batch = [];
    size = 0;
  };
  for (const p of pages) {
    if (batch.length >= 40 || size + p.text.length > 300_000) await flush();
    batch.push(p);
    size += p.text.length;
  }
  await flush();
  return (await saveLibraryFileText({ data: { fileId: src.id, pages: [], totalPages: texts.length } })).textPages ?? 0;
}

function Cite({ cite }: { cite: TsCite }) {
  return (
    <a
      href={citeUrl(cite)}
      target="_blank"
      rel="noopener"
      className="shrink-0 text-[11px] text-copper hover:underline"
      title={`Open ${cite.label} at page ${cite.page}`}
      data-testid="ts-cite"
    >
      {cite.label} · p. {cite.page}
    </a>
  );
}

function Heading({ n, title, note }: { n: number; title: string; note: string }) {
  return (
    <div className="mt-5 mb-1.5 flex items-baseline gap-2.5">
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">{n}</span>
      <h4 className="font-display text-[17px] font-medium">{title}</h4>
      <span className="ml-auto text-right text-[11px] text-muted-foreground">{note}</span>
    </div>
  );
}

function Lines({ lines, ordered, testId }: { lines: TsLine[]; ordered?: boolean; testId: string }) {
  if (!lines.length) return <p className="text-sm text-muted-foreground">The manual gives none for this issue.</p>;
  return (
    <ul className="divide-y divide-border" data-testid={testId}>
      {lines.map((l, i) => (
        <li key={i} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <span>
            {ordered ? <span className="mr-2 tabular text-muted-foreground">{i + 1}.</span> : null}
            {l.text}
          </span>
          <Cite cite={l.cite} />
        </li>
      ))}
    </ul>
  );
}

function PastFixes({ fixes, model }: { fixes: TsFix[]; model: string }) {
  if (!fixes.length) return null;
  return (
    <div className="mt-4 rounded-[10px] border border-primary bg-primary/[0.07] px-3 py-2.5" data-testid="ts-past-fixes">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
        Past Fixes On {model} · {fixes.length}
      </p>
      <ul className="mt-1 grid gap-2">
        {fixes.map((f) => (
          <li key={f.id} className="text-sm" data-testid="ts-past-fix">
            <p>
              <span className="font-semibold">{f.issue}</span> — {f.cause.replace(/[.\s]+$/, "")}.
              {f.checks ? <span> Checked: {f.checks.split("\n").map((c) => c.replace(/[.\s]+$/, "")).join("; ")}.</span> : null}
              {f.partNumber ? (
                <span>
                  {" "}
                  Part {f.partNumber}
                  {f.partName ? ` ${f.partName}` : ""}.
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {f.by} · {new Date(f.at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Troubleshoot one variation from its own manuals and parts book. Nothing is taken from another model,
 * and nothing is shown that the stored files do not say.
 */
export function TroubleshootPanel({ bookId, model }: { bookId: number; model: string }) {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["troubleshoot-sources", bookId], queryFn: () => troubleshootSources({ data: { bookId } }) });
  const [issue, setIssue] = useState("");
  const [asked, setAsked] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<TsResult | null>(null);
  const [explain, setExplain] = useState<TsExplain | null>(null);
  const [fixing, setFixing] = useState(false);
  const [cause, setCause] = useState("");
  const [otherCause, setOtherCause] = useState("");
  const [worked, setWorked] = useState<string[]>([]);
  const [part, setPart] = useState("");
  const [saved, setSaved] = useState(false);

  const sources = result?.sources ?? info.data?.sources ?? [];
  const manuals = sources.filter((s) => s.section === "manuals");
  const parts = sources.filter((s) => s.section === "parts");

  const run = useMutation({
    mutationFn: async (text: string) => {
      const list = (await troubleshootSources({ data: { bookId } })).sources;
      for (const src of list.filter((s) => s.textPages == null)) {
        setStep(`Reading ${src.label}…`);
        await readSource(src, setStep);
      }
      setStep("Looking through the manuals…");
      return runTroubleshoot({ data: { bookId, issue: text } });
    },
    onSuccess: (r, text) => {
      setResult(r);
      setAsked(text);
      setExplain(null);
      setFixing(false);
      setSaved(false);
      setCause("");
      setOtherCause("");
      setWorked([]);
      setPart("");
      void qc.invalidateQueries({ queryKey: ["troubleshoot-sources", bookId] });
      void qc.invalidateQueries({ queryKey: ["library-files"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not troubleshoot"),
    onSettled: () => setStep(null),
  });

  const plain = useMutation({
    mutationFn: () => {
      const cites = [...(result?.causes ?? []), ...(result?.checks ?? []), ...(result?.howTo ?? [])].map((l) => ({ fileId: l.cite.fileId, page: l.cite.page }));
      const unique = [...new Map(cites.map((c) => [`${c.fileId}:${c.page}`, c])).values()].slice(0, 20);
      return explainTroubleshoot({ data: { bookId, issue: asked, cites: unique } });
    },
    onSuccess: setExplain,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not explain"),
  });

  const fix = useMutation({
    mutationFn: () => {
      const found = result?.parts.find((p) => p.number && p.number === part) ?? null;
      return saveTroubleshootFix({
        data: { bookId, issue: asked, cause: cause === "__other" ? otherCause.trim() : cause, checks: worked, partNumber: found?.number ?? null, partName: found?.bookName ?? found?.name ?? null },
      });
    },
    onSuccess: () => {
      toast.success(`Saved for ${model}. It shows as a past fix next time.`);
      setSaved(true);
      setFixing(false);
      void qc.invalidateQueries({ queryKey: ["troubleshoot-sources", bookId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the fix"),
  });

  const sourceText = (s: TsSource) => (s.textPages === 0 ? `${s.label} (can't be read)` : s.label);
  const causeReady = cause === "__other" ? otherCause.trim().length >= 2 : !!cause;
  const ok = result?.status === "ok";

  return (
    <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3.5" data-testid="troubleshoot-panel">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-display text-xl font-medium">Troubleshoot · {model}</h3>
        <p className="text-xs text-muted-foreground" data-testid="ts-sources">
          {info.isLoading
            ? "Checking the files…"
            : manuals.length
              ? `Reads only: ${[...manuals, ...parts].map(sourceText).join(" · ")}`
              : `No manual on file for ${model}. Add its manual above to troubleshoot. Nothing is taken from another model.`}
        </p>
      </div>
      {manuals.length && !parts.length && !info.isLoading ? (
        <p className="mt-1 text-xs text-warning" data-testid="ts-no-parts-book">
          No parts book on file for {model}: parts will read "Not in the parts book".
        </p>
      ) : null}

      <form
        className="mt-2.5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (issue.trim().length >= 3 && !run.isPending) run.mutate(issue.trim());
        }}
      >
        <Input
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="What is it doing? no heat, leaking, error code, not dosing…"
          aria-label="The issue, in your words"
          className="h-11 flex-1 text-[15px]"
          maxLength={300}
          data-testid="ts-issue"
        />
        <Button type="submit" className="h-11" disabled={run.isPending || issue.trim().length < 3 || !manuals.length} data-testid="ts-run">
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />} Troubleshoot
        </Button>
      </form>
      {step ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status" data-testid="ts-step">
          {step}
        </p>
      ) : null}

      {result && !run.isPending ? (
        <div data-testid="ts-result" data-status={result.status}>
          <PastFixes fixes={result.pastFixes} model={model} />
          {!ok ? (
            <p className="mt-4 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm" role="status" data-testid="ts-message">
              {result.message}
            </p>
          ) : (
            <>
              <Heading n={1} title="Possible Causes" note="from the uploaded manual" />
              <Lines lines={result.causes} testId="ts-causes" />

              <Heading n={2} title="What To Check" note="in the manual's order" />
              <Lines lines={result.checks} ordered testId="ts-checks" />

              <Heading n={3} title="How To Check" note="the manual's test, not a new procedure" />
              {result.howTo.length ? (
                <ul className="grid gap-2" data-testid="ts-howto">
                  {result.howTo.map((l, i) => (
                    <li key={i} className="rounded-r-lg border-l-[3px] border-copper bg-card px-3 py-1.5 text-sm">
                      <p>{l.text}</p>
                      <p className="mt-1">
                        <Cite cite={l.cite} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">The manual gives no test for this issue.</p>
              )}

              <Heading n={4} title="Parts" note="from this variation's parts book" />
              {result.parts.length ? (
                <ul className="divide-y divide-border" data-testid="ts-parts">
                  {result.parts.map((p) => (
                    <li key={p.name} className="grid gap-x-3 gap-y-0.5 py-2 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline" data-testid="ts-part" data-found={p.number ? "true" : "false"}>
                      {p.number ? <span className="tabular font-semibold">{p.number}</span> : <span className="font-semibold text-warning">Not in the parts book</span>}
                      <span>{p.bookName ?? p.name}</span>
                      {p.cite ? (
                        <Cite cite={p.cite} />
                      ) : (
                        <a href={p.searchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline" data-testid="ts-part-search">
                          Search the web for this part <ExternalLink className="size-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">The manual calls for no part for this issue.</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" disabled={plain.isPending} onClick={() => plain.mutate()} data-testid="ts-explain">
                  {plain.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Explain In Plain Language
                </Button>
                {saved ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary" data-testid="ts-saved">
                    <Check className="size-4" /> Fix saved
                  </span>
                ) : (
                  <Button type="button" onClick={() => setFixing(!fixing)} aria-expanded={fixing} data-testid="ts-mark-fixed">
                    Mark Fixed
                  </Button>
                )}
              </div>

              {explain ? (
                <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2.5" data-testid="ts-explained">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">In Plain Language</p>
                  {explain.status === "ok" ? <Lines lines={explain.lines} ordered testId="ts-explain-lines" /> : <p className="mt-1 text-sm">{explain.message}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">This explains the manual. The manual's own steps above are the procedure.</p>
                </div>
              ) : null}

              {fixing ? (
                <form
                  className="mt-3 grid gap-3 rounded-[10px] border border-border bg-card p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (causeReady && !fix.isPending) fix.mutate();
                  }}
                  data-testid="ts-fix-form"
                >
                  <fieldset>
                    <legend className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Cause That It Was</legend>
                    <div className="mt-1 grid gap-1">
                      {[...result.causes.map((c) => c.text), "__other"].map((c) => (
                        <label key={c} className="flex min-h-10 items-center gap-2 text-sm">
                          <input type="radio" name="ts-cause" className="size-4" checked={cause === c} onChange={() => setCause(c)} data-testid="ts-fix-cause" />
                          {c === "__other" ? "Something else" : c}
                        </label>
                      ))}
                      {cause === "__other" ? <Input value={otherCause} onChange={(e) => setOtherCause(e.target.value)} placeholder="What it was" aria-label="What it was" maxLength={600} /> : null}
                    </div>
                  </fieldset>
                  {result.checks.length ? (
                    <fieldset>
                      <legend className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Checks That Worked</legend>
                      <div className="mt-1 grid gap-1">
                        {result.checks.map((c) => (
                          <label key={c.text} className="flex min-h-10 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={worked.includes(c.text)}
                              onChange={(e) => setWorked(e.target.checked ? [...worked, c.text] : worked.filter((w) => w !== c.text))}
                              data-testid="ts-fix-check"
                            />
                            {c.text}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  {result.parts.some((p) => p.number) ? (
                    <label className="grid gap-1 text-sm">
                      <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Part Used</span>
                      <select value={part} onChange={(e) => setPart(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm" data-testid="ts-fix-part">
                        <option value="">No part</option>
                        {result.parts
                          .filter((p) => p.number)
                          .map((p) => (
                            <option key={p.number} value={p.number!}>
                              {p.number} · {p.bookName ?? p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={!causeReady || fix.isPending} data-testid="ts-fix-save">
                      Save This Fix
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Saved for {model} only, with "{asked}", your name and today's date.
                    </span>
                  </div>
                </form>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {!result && (info.data?.fixCount ?? 0) > 0 ? (
        <p className={cn("mt-2 text-xs text-muted-foreground")} data-testid="ts-fix-count">
          {info.data!.fixCount} past fix{info.data!.fixCount === 1 ? "" : "es"} saved for {model}. Similar ones show with your result.
        </p>
      ) : null}
    </div>
  );
}
