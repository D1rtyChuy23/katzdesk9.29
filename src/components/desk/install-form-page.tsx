import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { getInstallForm, type InstallFormPayload } from "@/lib/ops/install-form-api";
import { formDate, type CheckNote, type FormRow } from "@/lib/ops/install-form";
import { TECH_NOTE_SECTIONS, entryKey, lineDone, stampText, type ChecklistKey, type FormEntries } from "@/lib/ops/install-form-entries";
import { plugImageSrc } from "@/lib/ops/plug-faces";
import { Button } from "@/components/ui/button";
import { FillInFormButton } from "./install-form-fill";

/** Rows on page 1, machines and blank write-in rows together. Blank rows drop when long notes need the room. */
const SLOTS = 8;
/** One Letter page, 11 in at 96 px to the inch. Each sheet is laid out at print size, on screen too. */
const PAGE_PX = 1056;
/** A sheet's width: 8.5 in at 96 px to the inch. */
const SHEET_PX = 816;
/** A serial this short was likely cut off when it was typed. */
const SHORT_SERIAL = 4;

const pad = (n: number) => String(n).padStart(2, "0");

/** Counts each time the page's web fonts finish loading, so measurements made with fallback fonts are redone. */
function useFontLoads(): number {
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts) return;
    let live = true;
    const bump = () => live && setLoads((n) => n + 1);
    void fonts.ready.then(bump);
    fonts.addEventListener("loadingdone", bump);
    return () => {
      live = false;
      fonts.removeEventListener("loadingdone", bump);
    };
  }, []);
  return loads;
}

type PdfFile = { blob: Blob; name: string };

/** The Katz Coffee mark from the band, as a PNG: a PDF can't take the SVG. Drawn tall enough to print sharp. */
async function markPng(): Promise<Uint8Array> {
  const img = new Image();
  img.src = "/brand/katz-coffee-mark.svg";
  await img.decode();
  const h = 300;
  const w = Math.round((h * (img.naturalWidth || 334)) / (img.naturalHeight || 177));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the logo");
  ctx.drawImage(img, 0, 0, w, h);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("This browser can't draw the logo");
  return new Uint8Array(await png.arrayBuffer());
}

/** The editable PDF of this form. pdf-lib loads only here, not with the rest of KatzDesk. */
async function makeFormPdf(data: InstallFormPayload): Promise<PdfFile> {
  const [{ buildInstallFormPdf, installFormPdfName }, logoPng] = await Promise.all([
    import("@/lib/ops/install-form-pdf"),
    // The band reads the same without the mark, so a logo that won't draw never stops the download.
    markPng().catch(() => null),
  ]);
  const bytes = await buildInstallFormPdf(data, { logoPng });
  return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), name: installFormPdfName(data) };
}

function saveFile({ blob, name }: PdfFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The PDF is made as soon as the form loads, so Download saves it in the same tap: a phone only lets a tap save a file
 * while it is still handling that tap.
 */
function useFormPdf(data: InstallFormPayload | undefined) {
  const [file, setFile] = useState<PdfFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!data) return;
    let live = true;
    setFile(null);
    setError(null);
    makeFormPdf(data).then(
      (made) => live && setFile(made),
      (e: unknown) => live && setError(e instanceof Error ? e.message : "Could not make the PDF"),
    );
    return () => {
      live = false;
    };
  }, [data, tries]);
  return {
    file,
    error,
    download: () => {
      if (file) saveFile(file);
      else if (error) setTries((n) => n + 1);
    },
  };
}

export function InstallFormPage({ installId }: { installId: number }) {
  const q = useQuery({
    queryKey: ["install-form", installId],
    queryFn: () => getInstallForm({ data: { installId } }),
    // A form left open in a tab reads the install again on coming back to it: a WO added meanwhile shows (Chuy, 10/27).
    refetchOnWindowFocus: "always",
  });
  // Nothing opens the print dialog on its own: Print and Download are the person's choice.
  const pdf = useFormPdf(q.data);
  const making = !!q.data && !pdf.file && !pdf.error;

  return (
    <div className="install-form-screen">
      <style>{FORM_CSS}</style>
      <div className="no-print kf-toolbar">
        {q.data ? <FillInFormButton data={q.data} /> : null}
        <Button type="button" size="sm" variant="outline" onClick={pdf.download} disabled={!q.data || making} data-testid="install-form-download">
          <Download className="size-4" />
          {making ? "Preparing PDF…" : pdf.error ? "Try The PDF Again" : "Download Editable PDF"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => window.print()} disabled={!q.data} data-testid="install-form-print">
          <Printer className="size-4" />
          Print
        </Button>
        <Link to="/installs" search={{ open: installId }} className="text-sm text-primary underline-offset-4 hover:underline">
          Back to the install
        </Link>
        <p className="kf-tip" data-testid="install-form-download-note">
          {pdf.error
            ? `Could not make the PDF: ${pdf.error}`
            : "Fill In Form saves the Done ticks, notes, Tech notes and sign-off on this install, and Print and the PDF show them. The PDF also opens in any PDF app to fill in there."}
        </p>
      </div>
      {q.isLoading ? <p className="p-6 text-sm">Loading the form…</p> : null}
      {q.error ? <p className="p-6 text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load the form"}</p> : null}
      {q.data ? (
        <div className="kf-stage">
          <FitToWidth>
            <FormSheets data={q.data} />
          </FitToWidth>
        </div>
      ) : null}
    </div>
  );
}

/**
 * On a screen narrower than a sheet (a phone), the sheets are drawn smaller to fit its width, the way a PDF viewer opens
 * a page, so a whole page shows at once and pinch zoom still reads the detail. Only the picture is scaled: the sheets
 * keep their Letter layout, so what fits on page 1 is the same on every screen, and print is never scaled.
 */
function FitToWidth({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const box = outer.current;
    const sheets = inner.current;
    if (!box || !sheets) return;
    const measure = () => {
      const scale = box.clientWidth > 0 ? Math.min(1, box.clientWidth / SHEET_PX) : 1;
      const height = sheets.offsetHeight;
      setFit((was) => (Math.abs(was.scale - scale) < 0.001 && was.height === height ? was : { scale, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The screen turning, and the sheets settling what fits on page 1, both change the size.
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    watch.observe(sheets);
    return () => watch.disconnect();
  }, []);
  const scaled = fit.scale < 1;
  return (
    <div
      ref={outer}
      className="kf-fit"
      data-scale={scaled ? fit.scale.toFixed(3) : undefined}
      style={scaled ? { height: Math.ceil(fit.height * fit.scale), overflow: "hidden" } : undefined}
    >
      <div ref={inner} className="kf-fit-sheets" style={scaled ? { width: SHEET_PX, transform: `scale(${fit.scale})` } : undefined}>
        {children}
      </div>
    </div>
  );
}

/** Blank write-in rows offered on the continued sheet, for extras. They drop too when the sheet is full. */
const CONTINUED_BLANKS = 2;

type PageFit = { key: string; blank: number; compact: boolean; split: number; extra: number };

/**
 * Keeps page 1 on one Letter page, in three steps, each tried only when the one before is not enough:
 * 1. blank write-in rows drop, one at a time;
 * 2. the page tightens up (`compact`), and the blank rows are offered again;
 * 3. the machines that still do not fit move to an extra sheet, "Equipment to install, continued" (`split` is how many
 *    machines stay on page 1).
 * The continued sheet keeps its own blank rows (`extra`) only while they fit. Measured again when the rows or the fonts
 * change. Nothing is ever cut off.
 */
function usePageFit(rows: FormRow[], fontLoads: number) {
  const main = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLElement>(null);
  const moreMain = useRef<HTMLDivElement>(null);
  const moreFoot = useRef<HTMLElement>(null);
  const wanted = Math.max(0, SLOTS - rows.length);
  const key = useMemo(() => `${fontLoads}:${JSON.stringify(rows)}`, [rows, fontLoads]);
  const [fit, setFit] = useState<PageFit>({ key, blank: wanted, compact: false, split: rows.length, extra: CONTINUED_BLANKS });
  const now = useMemo(
    () => (fit.key === key ? fit : { key, blank: wanted, compact: false, split: rows.length, extra: CONTINUED_BLANKS }),
    [fit, key, wanted, rows.length],
  );
  useLayoutEffect(() => {
    const body = main.current;
    const end = foot.current;
    const sheet = body?.parentElement;
    if (!body || !end || !sheet) return;
    // On a phone the sheets are drawn smaller (FitToWidth): measure in the sheet's own pixels, so what fits on page 1 is
    // the same on every screen and in print.
    const shown = sheet.getBoundingClientRect();
    const k = sheet.offsetWidth > 0 && shown.width > 0 ? shown.width / sheet.offsetWidth : 1;
    const px = (v: number) => v / k;
    const top = shown.top;
    const room = PAGE_PX - px(end.getBoundingClientRect().height);
    const over = px(body.getBoundingClientRect().bottom - top) > room;
    const more = moreMain.current;
    const moreEnd = moreFoot.current;
    const moreSheet = more?.parentElement;
    const moreOver =
      !!more &&
      !!moreEnd &&
      !!moreSheet &&
      px(more.getBoundingClientRect().bottom - moreSheet.getBoundingClientRect().top) > PAGE_PX - px(moreEnd.getBoundingClientRect().height);
    if (over && now.blank > 0) setFit({ ...now, blank: now.blank - 1 });
    // Tightening frees room, so the blank rows are offered again (and drop again if they still do not fit).
    else if (over && !now.compact) setFit({ ...now, blank: wanted, compact: true });
    else if (over && now.split > 1) {
      // The machines that end above the footer stay; at least one more moves each time, so this always settles.
      const bottoms = [...body.querySelectorAll<HTMLElement>("[data-testid=install-form-row]")].map((r) => px(r.getBoundingClientRect().bottom - top));
      const fits = bottoms.filter((b) => b <= room).length;
      setFit({ ...now, split: Math.max(1, Math.min(now.split - 1, fits)) });
    } else if (!over && moreOver && now.extra > 0) setFit({ ...now, extra: now.extra - 1 });
    else if (fit.key !== key) setFit(now);
  }, [now, fit.key, key, wanted]);
  return { main, foot, moreMain, moreFoot, ...now };
}

/**
 * Tech notes take as many sheets as they need: the boxes that end above a sheet's footer stay on it, and the rest start
 * the next sheet. One box always stays, so this settles. Measured in the sheet's own pixels, like usePageFit.
 */
function useNoteSheets(parts: string[], fontLoads: number) {
  const sheets = useRef<(HTMLElement | null)[]>([]);
  const key = `${fontLoads}:${JSON.stringify(parts)}`;
  const [fit, setFit] = useState<{ key: string; starts: number[] }>({ key, starts: [0] });
  const starts = useMemo(() => (fit.key === key ? fit.starts : [0]), [fit, key]);
  useLayoutEffect(() => {
    for (let s = 0; s < starts.length; s += 1) {
      const sheet = sheets.current[s];
      const end = sheet?.querySelector<HTMLElement>(".kf-foot");
      if (!sheet || !end) break;
      const shown = sheet.getBoundingClientRect();
      const k = sheet.offsetWidth > 0 && shown.width > 0 ? shown.width / sheet.offsetWidth : 1;
      const room = PAGE_PX - end.getBoundingClientRect().height / k;
      const bottoms = [...sheet.querySelectorAll<HTMLElement>(".kf-note-block")].map((b) => (b.getBoundingClientRect().bottom - shown.top) / k);
      const fits = bottoms.filter((b) => b <= room).length;
      if (bottoms.length > 1 && fits < bottoms.length) {
        setFit({ key, starts: [...starts.slice(0, s + 1), starts[s] + Math.max(1, fits), ...starts.slice(s + 1)] });
        return;
      }
    }
    if (fit.key !== key) setFit({ key, starts });
  }, [fit.key, key, starts]);
  return { sheets, starts };
}

function FormSheets({ data }: { data: InstallFormPayload }) {
  const fontLoads = useFontLoads();
  const entries = data.entries;
  const notes = entries?.techNotes ?? {};
  // Tech notes print on sheets of their own at the end, so they never push a fitted page past Letter.
  const noted = TECH_NOTE_SECTIONS.filter((s) => !!notes[s.key]);
  const { main, foot, moreMain, moreFoot, blank, compact, split, extra } = usePageFit(data.rows, fontLoads);
  const noteFit = useNoteSheets(
    noted.map((s) => `${s.key}:${notes[s.key]}`),
    fontLoads,
  );
  const noteSheets = noted.length ? noteFit.starts.map((from, i) => noted.slice(from, noteFit.starts[i + 1] ?? noted.length)) : [];
  const verifiedBy = entries?.verifiedBy || data.inspector;
  const verifiedOn = formDate(entries?.verifiedOn) || data.inspectedOn;
  const units = data.rows.reduce((n, r) => n + r.qty, 0);
  const first = data.rows.slice(0, split);
  const rest = data.rows.slice(split);
  const restUnits = rest.reduce((n, r) => n + r.qty, 0);
  const checklistPage = rest.length ? 3 : 2;
  const pages = checklistPage + noteSheets.length;
  const footer = (page: number) => (
    <>
      <div className="kf-foot-rule" />
      <div className="kf-foot-row">
        <span>Katz Coffee · Service Department</span>
        <span>
          Install #{data.id}
          {data.customer ? ` · ${data.customer}` : ""}
        </span>
        <span>
          Page {page} of {pages}
        </span>
      </div>
    </>
  );
  return (
    <article id="install-form" data-testid="install-form">
      <section className={compact ? "kf-sheet kf-compact" : "kf-sheet"} aria-label="Page 1, equipment request" data-compact={compact || undefined}>
        <Band kind="request" id={data.id} page={1} pages={pages} />
        <div className="kf-main" ref={main}>
          <section aria-label="Account and install details">
            <div className="kf-section-head">
              <span className="kf-kicker">Account &amp; install</span>
              <span className="kf-tag">Sales rep</span>
            </div>
            <div className="kf-fields">
              <Field label="Customer" strong value={data.customer} />
              <Field label="Install date" strong value={data.installDate} />
              <Field label="Site contact" value={data.siteContact} testId="install-form-contact" />
              <Field label="Contact phone" value={data.contactPhone} testId="install-form-phone" />
              <Field label="Install address" value={data.address} />
              <Field label="Account rep" value={data.accountRep} />
              <div className="kf-field">
                <span className="kf-label">Account type</span>
                <span className="kf-types">
                  <span className="kf-type">
                    <Box on={data.accountType === "new"} />
                    New account
                  </span>
                  <span className="kf-type">
                    <Box on={data.accountType === "update"} />
                    Update
                  </span>
                </span>
              </div>
              <Field label="Technician" value={data.technician} />
            </div>
          </section>

          <section aria-label="Equipment to install" data-testid="install-form-equipment">
            <div className="kf-eq-head">
              <h2 className="kf-h2">Equipment to install</h2>
              <span className="kf-eq-count">
                {units} {units === 1 ? "unit" : "units"}
                {rest.length ? ` · ${restUnits} more on page 2` : " · write in any extras"}
              </span>
            </div>
            <EquipmentBar />
            {first.map((row, i) => (
              <EquipmentRow key={i} num={i + 1} row={row} />
            ))}
            {Array.from({ length: rest.length ? 0 : blank }, (_, i) => (
              <BlankRow key={`blank-${i}`} num={data.rows.length + i + 1} />
            ))}
          </section>
        </div>
        <footer className="kf-foot" ref={foot}>
          {footer(1)}
        </footer>
      </section>

      {rest.length ? (
        <section className="kf-sheet kf-compact" aria-label="Page 2, equipment continued" data-testid="install-form-continued">
          <Band kind="continued" id={data.id} page={2} pages={pages} />
          <div className="kf-main" ref={moreMain}>
            <section aria-label="Equipment to install, continued">
              <div className="kf-eq-head">
                <h2 className="kf-h2">Equipment to install, continued</h2>
                {extra ? <span className="kf-eq-count">Write in any extras</span> : null}
              </div>
              <EquipmentBar />
              {rest.map((row, i) => (
                <EquipmentRow key={i} num={split + i + 1} row={row} />
              ))}
              {Array.from({ length: extra }, (_, i) => (
                <BlankRow key={`blank-${i}`} num={data.rows.length + i + 1} />
              ))}
            </section>
          </div>
          <footer className="kf-foot" ref={moreFoot}>
            {footer(2)}
          </footer>
        </section>
      ) : null}

      <section className="kf-sheet kf-p2" aria-label={`Page ${checklistPage}, checklist and sign-off`}>
        <Band kind="checklist" id={data.id} page={checklistPage} pages={pages} />
        <div className="kf-main">
          <CheckSection
            title="Pre-installation checklist"
            role="Sales rep · Pre-inspection"
            list="pre"
            rows={data.pre}
            entries={entries}
            testId="install-form-pre"
          >
            <div className="kf-after">
              <span>
                <span className="kf-label">Verified by</span>
                {verifiedBy ? (
                  <span className="kf-after-value" data-testid="install-form-verified-by">
                    {verifiedBy}
                  </span>
                ) : (
                  <span className="kf-write kf-w160" />
                )}
              </span>
              <span>
                <span className="kf-label">Date</span>
                {verifiedOn ? <span className="kf-after-value">{verifiedOn}</span> : <span className="kf-write kf-w120" />}
              </span>
            </div>
          </CheckSection>
          <CheckSection
            title="Installation tasks"
            role="Tech on site"
            list="tasks"
            rows={data.tasks}
            entries={entries}
            testId="install-form-tasks"
          />
          <CheckSection
            title="Corrigo account update tasks"
            role="Tech or office"
            list="corrigo"
            rows={data.corrigo}
            entries={entries}
            testId="install-form-corrigo"
          >
            <div className="kf-after kf-wos" data-testid="install-form-wos">
              <span className="kf-label">{data.workOrders.length > 1 ? "Corrigo work orders" : "Corrigo work order #"}</span>
              {data.workOrders.length ? (
                data.workOrders.map((wo) => (
                  <span key={wo} className="kf-mono-chip">
                    {wo}
                  </span>
                ))
              ) : (
                <span className="kf-write kf-w220" />
              )}
            </div>
          </CheckSection>

          <section className="kf-signoff" aria-label="Sign-off">
            <div className="kf-sign-bar">
              <span className="kf-sign-title">Sign-off</span>
              <span className="kf-sign-note">Signed electronically in KatzDesk</span>
            </div>
            <div className="kf-sign-grid">
              <div className="kf-sign-cell" data-testid="install-form-tech-sign">
                <span className="kf-label">Technician · Complete &amp; sign</span>
                <span className="kf-sign-name">{entries?.techName || data.technician || <span className="kf-write kf-w180" />}</span>
                {entries?.signed ? (
                  <span className="kf-stamp-done">Signed · {stampText(entries.signed)}</span>
                ) : (
                  <span className="kf-stamp-empty">Not signed yet</span>
                )}
                <span className="kf-sign-meta">Date completed: {formDate(entries?.completedOn) || data.completedOn || "—"}</span>
              </div>
              <div className="kf-sign-cell" data-testid="install-form-owner-sign">
                <span className="kf-label">Final approval · Owner</span>
                <span className="kf-sign-name">Chuy</span>
                {entries?.approved ? (
                  <span className="kf-stamp-done">Approved · {stampText(entries.approved)}</span>
                ) : (
                  <span className="kf-stamp-empty">Waiting for approval</span>
                )}
                <span className="kf-sign-meta">
                  {entries?.approved ? `Date approved: ${formDate(entries.approvedOn) || "—"}` : "Approved after the technician signs"}
                </span>
              </div>
            </div>
          </section>
        </div>
        <footer className="kf-foot">{footer(checklistPage)}</footer>
      </section>

      {noteSheets.map((group, i) => {
        const page = checklistPage + 1 + i;
        return (
          <section
            key={i}
            ref={(el) => {
              noteFit.sheets.current[i] = el;
            }}
            className="kf-sheet kf-p2"
            aria-label={`Page ${page}, tech notes`}
            data-testid="install-form-technotes"
          >
            <Band kind={i ? "notesMore" : "notes"} id={data.id} page={page} pages={pages} />
            <div className="kf-main">
              {group.map((s) => (
                <section key={s.key} className="kf-note-block" aria-label={`Tech notes: ${s.title}`} data-testid={`install-form-technotes-${s.key}`}>
                  <span className="kf-kicker">{s.title}</span>
                  <p className="kf-note-text">{notes[s.key]}</p>
                </section>
              ))}
            </div>
            <footer className="kf-foot">{footer(page)}</footer>
          </section>
        );
      })}
    </article>
  );
}

const BAND_TEXT = {
  request: { lead: "Service Department · Install Request", title: "Equipment Request Form" },
  continued: { lead: "Service Department · Install Request", title: "Equipment to Install, Continued" },
  checklist: { lead: "Come and fix it.", title: "Install Checklist & Sign-Off" },
  notes: { lead: "Come and fix it.", title: "Tech Notes" },
  notesMore: { lead: "Come and fix it.", title: "Tech Notes, Continued" },
} as const;
const MOTTO = "Come and fix it.";

/** The dark badge band across the top of a sheet, with the gold double rule under it. Page 1 gets the tall band. */
function Band({ kind, id, page, pages }: { kind: keyof typeof BAND_TEXT; id: number; page: number; pages: number }) {
  const text = BAND_TEXT[kind];
  const tall = kind === "request";
  return (
    <>
      <header className={tall ? "kf-band" : "kf-band kf-band-2"}>
        <img className="kf-cloud" src="/brand/cloud.png" alt="" aria-hidden="true" />
        <img className="kf-logo" src="/brand/katz-coffee-mark.svg" alt="Katz Coffee" width={334} height={177} />
        <div className="kf-band-text">
          <span className={text.lead === MOTTO ? "kf-motto" : "kf-eyebrow"}>{text.lead}</span>
          {tall ? <h1 className="kf-title">{text.title}</h1> : <h2 className="kf-title">{text.title}</h2>}
        </div>
        <div className="kf-badge">
          {tall ? <span className="kf-badge-label">Install</span> : null}
          <span className="kf-badge-num">#{id}</span>
          <span className="kf-badge-page">
            Page {page} of {pages}
          </span>
        </div>
      </header>
      <div className="kf-rule" />
      <div className="kf-rule kf-rule-thin" />
    </>
  );
}

function EquipmentBar() {
  return (
    <div className="kf-eq-grid kf-eq-bar" aria-hidden="true">
      <span>No.</span>
      <span>Equipment</span>
      <span>Serial</span>
      <span className="kf-center">Qty</span>
      <span>Terms</span>
    </div>
  );
}

function Field({ label, value, strong, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <div className="kf-field" data-testid={testId}>
      <span className="kf-label">{label}</span>
      <span className={strong ? "kf-value kf-strong" : "kf-value"}>{value}</span>
    </div>
  );
}

function Tick({ size, color }: { size: number; color: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 12 12">
      <polyline points="2.4,6.4 5,9 9.6,3.4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Box({ on }: { on: boolean }) {
  return <span className={on ? "kf-box kf-on" : "kf-box"}>{on ? <Tick size={12} color="#ffffff" /> : null}</span>;
}

function EquipmentRow({ num, row }: { num: number; row: FormRow }) {
  // A model listed twice with one serial gets a line to write the other one on.
  const missing = Math.max(0, row.qty - row.serials.length);
  return (
    <div className="kf-row" data-testid="install-form-row">
      <div className="kf-eq-grid">
        <span className="kf-num">{pad(num)}</span>
        <span className="kf-name">{row.equipment}</span>
        <span className="kf-serials">
          {row.serials.map((serial) => (
            <span key={serial} className="kf-serial">
              <span className="kf-mono-chip">{serial}</span>
              {serial.length < SHORT_SERIAL ? <span className="kf-verify">Verify</span> : null}
            </span>
          ))}
          {Array.from({ length: missing }, (_, i) => (
            <span key={`write-${i}`} className="kf-write kf-w120" />
          ))}
        </span>
        <span className="kf-qty">{row.qty}</span>
        <span className="kf-terms">{row.terms ? <span className="kf-pill">{row.terms}</span> : <span className="kf-not-set">Not set</span>}</span>
      </div>
      <div className="kf-line2">
        <span className="kf-outlet">
          {row.plugs.map((nema) => (
            <img key={nema} className="kf-plug" src={plugImageSrc(nema)} alt={`NEMA ${nema} plug`} width={26} height={26} />
          ))}
          <span className="kf-label">Outlet</span>
          {row.outlet ? <span className="kf-outlet-text">{row.outlet}</span> : <span className="kf-write kf-w150" />}
        </span>
        <span className="kf-notes">
          <span className="kf-label">Notes</span>
          {row.notes.length ? (
            <span className="kf-notes-text">
              {row.notes.map((note, i) => (
                <Fragment key={i}>
                  {i ? <span className="kf-sep"> · </span> : null}
                  {note.title ? <strong>{note.title}</strong> : null}
                  {note.title && note.text ? " " : null}
                  {note.text}
                </Fragment>
              ))}
            </span>
          ) : (
            <span className="kf-write kf-grow" />
          )}
        </span>
      </div>
    </div>
  );
}

function BlankRow({ num }: { num: number }) {
  return (
    <div className="kf-row kf-blank" data-testid="install-form-blank-row">
      <div className="kf-eq-grid">
        <span className="kf-num">{pad(num)}</span>
        <span className="kf-write" />
        <span className="kf-write" />
        <span className="kf-write" />
        <span className="kf-write" />
      </div>
      <div className="kf-line2">
        <span className="kf-label">Outlet</span>
        <span className="kf-write kf-w150" />
        <span className="kf-label kf-gap">Notes</span>
        <span className="kf-write kf-grow" />
      </div>
    </div>
  );
}

function CheckValue({ value }: { value: string }) {
  if (value === "YES")
    return (
      <span className="kf-chip kf-yes">
        <Tick size={10} color="#1f5a47" />
        Yes
      </span>
    );
  if (value === "PENDING") return <span className="kf-chip kf-pending">Pending</span>;
  if (value === "NO") return <span className="kf-chip kf-no">No</span>;
  return value ? <span className="kf-check-text">{value}</span> : null;
}

function CheckSection({
  title,
  role,
  list,
  rows,
  entries,
  testId,
  children,
}: {
  title: string;
  role: string;
  list: ChecklistKey;
  rows: CheckNote[];
  entries?: FormEntries;
  testId: string;
  children?: ReactNode;
}) {
  return (
    <section className="kf-check" aria-label={title} data-testid={testId}>
      <div className="kf-check-grid kf-check-bar">
        <span className="kf-check-title">
          <span className="kf-bar-title">{title}</span>
          <span className="kf-role">{role}</span>
        </span>
        <span className="kf-bar-label">Notes</span>
        <span className="kf-bar-label kf-center">Done</span>
      </div>
      {rows.map((row) => {
        const done = lineDone(entries, list, row.label);
        // The tech's note replaces what KatzDesk shows on the line.
        const own = entries?.notes[entryKey(list, row.label)];
        return (
          <div key={row.label} className="kf-check-grid kf-check-row" data-testid="install-form-check" data-done={done || undefined}>
            <span>{row.label}</span>
            <span className="kf-check-notes">{own ? <span className="kf-check-text">{own}</span> : <CheckValue value={row.notes} />}</span>
            <span className="kf-done">
              <Box on={done} />
            </span>
          </div>
        );
      })}
      {children}
    </section>
  );
}

/**
 * Design A, "Badge band". Each sheet is a Letter page at 96 px to the inch: 816 x 1056. On screen the sheets sit on the
 * page like paper; on a screen narrower than a sheet they are drawn smaller to fit its width (FitToWidth). In print,
 * only the form prints, edge to edge, one sheet per page, never scaled.
 */
const FORM_CSS = `
.kf-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding-bottom: 12px; }
.kf-tip { flex-basis: 100%; margin: -4px 0 0; font-size: 12px; color: var(--color-muted-foreground); }
.kf-stage { overflow-x: auto; padding: 4px 2px 24px; }
.kf-fit-sheets { transform-origin: top left; }
#install-form { width: 816px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.kf-sheet { width: 816px; min-height: ${PAGE_PX}px; box-sizing: border-box; display: flex; flex-direction: column; position: relative;
  background: #ffffff; color: #1a1612; font-family: var(--font-sans); font-size: 14px; line-height: 1.3; text-align: left;
  border: 1px solid #e5ded2; box-shadow: 0 1px 2px rgb(28 25 23 / 0.08), 0 12px 32px rgb(28 25 23 / 0.12);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.kf-sheet * { box-sizing: border-box; }

.kf-band { height: 140px; flex-shrink: 0; background: #100f0d; display: flex; align-items: center; gap: 24px; padding: 0 48px; position: relative; overflow: hidden; }
.kf-cloud { position: absolute; right: 120px; top: -46px; height: 230px; width: auto; opacity: 0.09; pointer-events: none; }
.kf-logo { height: 98px; width: auto; display: block; position: relative; flex-shrink: 0; }
.kf-band-text { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; position: relative; }
.kf-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #f0e6a3; }
.kf-motto { font-family: var(--font-display); font-style: italic; font-size: 15px; font-weight: 500; color: #f0e6a3; }
.kf-title { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 33px; line-height: 1.04; color: #fbf6e4; text-wrap: balance; letter-spacing: 0; }
.kf-badge { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: #f0e6a3; position: relative; flex-shrink: 0; }
.kf-badge-label { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
.kf-badge-num { font-family: var(--font-display); font-size: 42px; font-weight: 600; line-height: 1; }
.kf-badge-page { font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
.kf-band-2 { height: 100px; gap: 22px; }
.kf-band-2 .kf-cloud { right: 130px; top: -40px; height: 180px; }
.kf-band-2 .kf-logo { height: 70px; }
.kf-band-2 .kf-band-text { gap: 4px; }
.kf-band-2 .kf-title { font-size: 28px; line-height: 1.05; }
.kf-band-2 .kf-badge-num { font-size: 32px; }
.kf-rule { flex-shrink: 0; height: 4px; background: #a8862a; }
.kf-rule-thin { height: 2px; margin-top: 3px; }

.kf-main { padding: 18px 48px 0; display: flex; flex-direction: column; gap: 18px; }
.kf-p2 .kf-main { padding-top: 16px; gap: 14px; }
.kf-section-head { display: flex; align-items: center; justify-content: space-between; }
.kf-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.kf-tag { display: inline-flex; align-items: center; padding: 1px 9px; border: 1px solid #a8862a; border-radius: 999px; background: #fbf5e6;
  font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8f6a22; }
.kf-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; margin-top: 2px; }
.kf-field { display: flex; flex-direction: column; gap: 3px; padding: 8px 0 7px; border-bottom: 1px solid #3a332b; min-width: 0; }
.kf-label { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5f584f; white-space: nowrap; }
.kf-value { display: block; min-height: 23px; font-size: 17px; font-weight: 600; line-height: 23px; overflow-wrap: anywhere; }
.kf-strong { font-weight: 700; }
.kf-types { display: flex; align-items: center; gap: 22px; min-height: 23px; font-size: 15px; font-weight: 600; }
.kf-type { display: inline-flex; align-items: center; gap: 8px; }
.kf-box { width: 16px; height: 16px; border: 1.5px solid #1a1612; display: inline-grid; place-items: center; flex-shrink: 0; }
.kf-on { background: #1a1612; }

.kf-eq-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.kf-h2 { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: 0; }
.kf-eq-count { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #5f584f; }
/* Serial is wide enough for an 18-character Eversys serial on one line. */
.kf-eq-grid { display: grid; grid-template-columns: 34px minmax(0, 1fr) 164px 40px 112px; column-gap: 10px; align-items: center; }
.kf-eq-bar { background: #100f0d; color: #f0e6a3; padding: 7px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.kf-center { text-align: center; }
.kf-row { min-height: 62px; border: 1px solid #cfc6b8; border-top: 0; padding: 7px 12px 6px; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; break-inside: avoid; }
.kf-num { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: #8f6a22; }
.kf-name { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; overflow-wrap: anywhere; }
.kf-serials { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.kf-serial { display: flex; align-items: center; gap: 6px; max-width: 100%; }
.kf-mono-chip { font-family: var(--font-mono); font-size: 13px; font-weight: 500; line-height: 1.35; border: 1px solid #1a1612; border-radius: 4px; padding: 1px 6px; overflow-wrap: anywhere; }
.kf-verify { font-size: 12px; font-weight: 700; color: #8f6a22; text-transform: uppercase; letter-spacing: 0.08em; }
.kf-qty { font-size: 15px; font-weight: 700; text-align: center; }
.kf-terms { display: flex; align-items: center; }
.kf-pill { display: inline-flex; align-items: center; padding: 0 9px; border: 1px solid #1a1612; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.5; }
.kf-not-set { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8f6a22; }
/* Short notes sit beside the outlet; notes too long for that wrap onto their own line, full width. */
.kf-line2 { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding-left: 44px; min-width: 0; }
.kf-outlet { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.kf-plug { height: 26px; width: 26px; display: block; object-fit: contain; }
.kf-outlet-text { font-size: 14px; font-weight: 600; white-space: nowrap; }
.kf-notes { display: flex; align-items: baseline; gap: 8px; flex: 1 1 auto; min-width: 0; border-left: 1px solid #cfc6b8; margin-left: 6px; padding-left: 12px; }
.kf-notes-text { font-size: 14px; font-weight: 500; line-height: 1.35; min-width: 0; overflow-wrap: anywhere; }
.kf-notes-text strong { font-weight: 700; }
.kf-sep { color: #8a8174; }
.kf-write { display: block; height: 18px; border-bottom: 1px solid #8a8174; }
.kf-w120 { width: 120px; height: 16px; }
.kf-w150 { width: 150px; height: 16px; }
.kf-w160 { width: 160px; }
.kf-w180 { width: 180px; }
.kf-w220 { width: 220px; }
.kf-grow { flex: 1; min-width: 60px; height: 16px; }
.kf-gap { margin-left: 14px; }
.kf-blank .kf-eq-grid { align-items: end; height: 24px; }
.kf-blank .kf-line2 { align-items: flex-end; }

/* Page 1 when the machines alone overflow it: a shorter band, tighter fields and rows, smaller notes. */
.kf-compact .kf-band:not(.kf-band-2) { height: 112px; }
.kf-compact .kf-band:not(.kf-band-2) .kf-logo { height: 78px; }
.kf-compact .kf-band:not(.kf-band-2) .kf-cloud { top: -40px; height: 190px; }
.kf-compact .kf-band:not(.kf-band-2) .kf-band-text { gap: 4px; }
.kf-compact .kf-band:not(.kf-band-2) .kf-title { font-size: 29px; }
.kf-compact .kf-band:not(.kf-band-2) .kf-badge-num { font-size: 36px; }
.kf-compact .kf-main { padding-top: 14px; gap: 12px; }
.kf-compact .kf-field { gap: 1px; padding: 5px 0 4px; }
.kf-compact .kf-value { min-height: 20px; font-size: 15px; line-height: 20px; }
.kf-compact .kf-types { min-height: 20px; font-size: 14px; }
.kf-compact .kf-eq-head { margin-bottom: 6px; }
.kf-compact .kf-h2 { font-size: 20px; }
.kf-compact .kf-row { min-height: 54px; padding: 5px 12px 4px; gap: 3px; }
.kf-compact .kf-notes-text { font-size: 13px; line-height: 1.3; }

.kf-check { display: flex; flex-direction: column; break-inside: avoid; }
.kf-check-grid { display: grid; grid-template-columns: minmax(0, 1fr) 180px 60px; column-gap: 10px; align-items: center; }
.kf-check-bar { background: #100f0d; padding: 6px 12px; }
.kf-check-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.kf-bar-title { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: #f0e6a3; white-space: nowrap; }
.kf-role { display: inline-flex; align-items: center; padding: 0 8px; border: 1px solid #f0e6a3; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #f0e6a3; white-space: nowrap; }
.kf-bar-label { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #f0e6a3; }
.kf-check-row { min-height: 24px; padding: 0 12px; border: 1px solid #cfc6b8; border-top: 0; font-size: 13.5px; }
.kf-check-notes { display: flex; align-items: center; min-width: 0; }
.kf-chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 0 8px; font-size: 12px; font-weight: 700; line-height: 1.5; }
.kf-yes { border: 1px solid #1f5a47; color: #1f5a47; background: #eef4f1; }
.kf-pending { border: 1px solid #8f6a22; color: #8f6a22; background: #fbf5e6; }
.kf-no { border: 1px solid #9a3412; color: #9a3412; background: #fdf0ea; }
.kf-check-text { font-weight: 600; overflow-wrap: anywhere; }
.kf-done { display: flex; justify-content: center; }
.kf-after { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 28px; padding: 8px 12px 0; font-size: 14px; }
.kf-after > span { display: inline-flex; align-items: flex-end; gap: 6px; }
.kf-after-value { font-weight: 700; }
.kf-wos { gap: 8px 10px; padding-top: 10px; }

.kf-signoff { border: 1.5px solid #100f0d; display: flex; flex-direction: column; break-inside: avoid; }
.kf-sign-bar { background: #100f0d; padding: 6px 14px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.kf-sign-title { font-family: var(--font-display); font-size: 17px; font-weight: 600; color: #f0e6a3; }
.kf-sign-note { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #f0e6a3; }
.kf-sign-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.kf-sign-cell { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; min-width: 0; }
.kf-sign-cell + .kf-sign-cell { border-left: 1px solid #cfc6b8; }
.kf-sign-name { display: block; min-height: 20px; font-size: 15px; font-weight: 700; }
.kf-stamp-empty { display: flex; align-items: center; height: 40px; border: 1.5px dashed #8a8174; border-radius: 6px; padding: 0 12px; font-size: 13px; font-weight: 600; color: #5f584f; }
.kf-stamp-done { display: flex; align-items: center; min-height: 40px; border: 1.5px solid #1f5a47; border-radius: 6px; padding: 4px 12px; font-size: 13px; font-weight: 700; color: #1f5a47; background: #eef4f1; overflow-wrap: anywhere; }
.kf-note-block { border: 1px solid #cfc6b8; border-left: 4px solid #a8862a; padding: 10px 14px 12px; break-inside: avoid; }
.kf-note-text { margin: 6px 0 0; font-size: 14px; font-weight: 500; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.kf-sign-meta { font-size: 12px; color: #5f584f; }

.kf-foot { margin-top: auto; padding: 10px 48px 30px; }
.kf-foot-rule { height: 1px; background: #a8862a; }
.kf-foot-row { display: flex; justify-content: space-between; gap: 12px; padding-top: 8px; font-size: 12px; color: #5f584f; letter-spacing: 0.04em; }

@media print {
  @page { size: letter; margin: 0; }
  html, body { background: #ffffff !important; }
  /* Only the form prints. Everything around it leaves the layout, so no blank pages follow it. */
  body *:not(:has(#install-form)):not(#install-form):not(#install-form *) { display: none !important; }
  body *:has(#install-form) { display: block !important; position: static !important; overflow: visible !important; margin: 0 !important;
    padding: 0 !important; border: 0 !important; min-height: 0 !important; height: auto !important; width: auto !important;
    max-width: none !important; background: none !important; box-shadow: none !important; transform: none !important; }
  #install-form { display: block; width: 8.5in; margin: 0; }
  .kf-sheet { width: 8.5in; min-height: 11in; border: 0; box-shadow: none; break-after: page; }
  .kf-sheet:last-child { break-after: auto; }
  /* A phone's fit-to-screen view never reaches the paper. */
  .kf-fit { height: auto !important; overflow: visible !important; }
  .kf-fit-sheets { width: auto !important; transform: none !important; }
}
/* An older browser without :has() hides the app around the form instead, the way this page always printed. */
@supports not selector(:has(*)) {
  @media print {
    body * { visibility: hidden; }
    #install-form, #install-form * { visibility: visible; }
    #install-form { position: absolute; left: 0; top: 0; }
  }
}
`;
