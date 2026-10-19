import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { getInstallForm, type InstallFormPayload } from "@/lib/ops/install-form-api";
import { Button } from "@/components/ui/button";

const SLOTS = 8;

function Box({ on }: { on: boolean }) {
  return <span className="form-box">{on ? "✓" : ""}</span>;
}

function CheckTable({ title, rows, testId }: { title: string; rows: { label: string; notes: string }[]; testId: string }) {
  return (
    <table className="form-table" data-testid={testId}>
      <thead>
        <tr>
          <th>{title}</th>
          <th className="notes">NOTES</th>
          <th className="done">DONE (✓)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.notes}</td>
            <td className="done"><span className="form-box" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InstallFormPage({ installId }: { installId: number }) {
  const q = useQuery({
    queryKey: ["install-form", installId],
    queryFn: () => getInstallForm({ data: { installId } }),
  });
  useEffect(() => {
    if (!q.data) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [q.data]);

  return (
    <div className="install-form-screen">
      <style>{FORM_CSS}</style>
      <div className="no-print form-toolbar">
        <Button type="button" size="sm" onClick={() => window.print()} disabled={!q.data}>
          <Printer className="size-4" />
          Print
        </Button>
        <Link to="/installs" search={{ open: installId }} className="text-sm text-primary underline-offset-4 hover:underline">
          Back to the install
        </Link>
      </div>
      {q.isLoading ? <p className="p-6 text-sm">Loading the form…</p> : null}
      {q.error ? <p className="p-6 text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load the form"}</p> : null}
      {q.data ? <FormSheets data={q.data} /> : null}
    </div>
  );
}

function FormSheets({ data }: { data: InstallFormPayload }) {
  const slots = Array.from({ length: Math.max(SLOTS, data.rows.length) }, (_, i) => data.rows[i] ?? null);
  return (
    <article id="install-form" data-testid="install-form">
      <section className="sheet">
        <header className="form-head">
          <div className="mark">
            <strong>KATZ</strong>
            <span>COFFEE</span>
          </div>
          <div>
            <h1>COFFEE EQUIPMENT<br />REQUEST FORM</h1>
          </div>
          <p className="page">1/2</p>
        </header>
        <dl className="meta">
          <div><dt>CUSTOMER NAME:</dt><dd>{data.customer}</dd></div>
          <div className="split">
            <div><dt>CONTACT PHONE #:</dt><dd>{data.phone}</dd></div>
            <div><dt>INSTALL DATE:</dt><dd>{data.installDate}</dd></div>
          </div>
          <div><dt>INSTALL ADDRESS:</dt><dd>{data.address}</dd></div>
          <div className="split">
            <div className="type">
              <dt>ACCOUNT TYPE:</dt>
              <dd>
                <Box on={data.accountType === "new"} /> NEW ACCOUNT
                <Box on={data.accountType === "update"} /> UPDATE
              </dd>
            </div>
            <div><dt>ACCOUNT REP:</dt><dd>{data.accountRep}</dd></div>
          </div>
        </dl>
        <table className="form-table equip" data-testid="install-form-equipment">
          <thead>
            <tr>
              <th>EQUIPMENT TO INSTALL</th>
              <th className="qty">QTY</th>
              <th>NOTES/DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((row, i) => (
              <tr key={i} className="equip-block">
                <td colSpan={3} className="equip-cell">
                  <div className="equip-line">
                    <span>{row?.equipment ?? ""}</span>
                    <span className="qty">{row ? row.qty : ""}</span>
                    <span>{row?.notes ?? ""}</span>
                  </div>
                  <div className="outlet">OUTLET (VOLTAGE/AMPERAGE): {row?.outlet ?? ""}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sheet page-two">
        <header className="form-head">
          <div className="mark mark-2">
            <strong>KATZ</strong>
            <span>COME AND FIX IT</span>
          </div>
          <div>
            <h1>COFFEE EQUIPMENT<br />REQUEST FORM</h1>
          </div>
          <p className="page">2/2</p>
        </header>
        <CheckTable title="PRE-INSTALLATION CHECKLIST" rows={data.pre} testId="install-form-pre" />
        <p className="verify">
          <span>VERIFIED BY: {data.inspector}</span>
          <span>DATE: {data.inspectedOn}</span>
        </p>
        <CheckTable title="INSTALLATION TASKS" rows={data.tasks} testId="install-form-tasks" />
        <CheckTable title="CORRIGO ACCOUNT UPDATE TASKS" rows={data.corrigo} testId="install-form-corrigo" />
        <p className="wo">Corrigo Work Order #: {data.wo}</p>
        <div className="signoff">
          <p className="sign-title">FINAL SIGN-OFF</p>
          <div className="sign-grid">
            <p>Tech Name/Signature: <span className="line">{data.technician}</span> <span className="line sign" /></p>
            <p className="date-box">Date: <span className="line" /></p>
            <p>Manager Sign-Off: <span className="line sign" /></p>
          </div>
        </div>
      </section>
    </article>
  );
}

const FORM_CSS = `
.install-form-screen { background: #fff; color: #1a1612; }
.form-toolbar { display: flex; gap: 12px; align-items: center; padding: 12px 16px; }
#install-form { width: 8.5in; margin: 0 auto; }
.sheet { padding: 0.35in 0.4in 0.3in; }
.form-head { display: grid; grid-template-columns: 1.7in 1fr auto; gap: 12px; align-items: center; border-bottom: 3px solid #6aa84f; padding-bottom: 8px; }
.mark { display: grid; place-items: center; border: 3px solid #6aa84f; border-radius: 999px; min-height: 72px; color: #3d7a32; text-align: center; line-height: 1.05; }
.mark strong { font-size: 22px; letter-spacing: 0.08em; }
.mark span { font-size: 11px; letter-spacing: 0.14em; }
.mark-2 { border-radius: 12px; }
.form-head h1 { margin: 0; font-size: 26px; line-height: 1; letter-spacing: -0.02em; }
.page { margin: 0; color: #6aa84f; font-weight: 700; }
.meta { margin: 10px 0; font-size: 12px; }
.meta dt { display: inline; font-weight: 700; }
.meta dd { display: inline; margin: 0 0 0 6px; }
.meta > div { border-bottom: 1px solid #222; padding: 3px 0; min-height: 18px; }
.split { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; border-bottom: 0; }
.split > div { border-bottom: 1px solid #222; }
.type dd { display: inline-flex; align-items: center; gap: 6px; }
.form-box { display: inline-grid; place-items: center; width: 12px; height: 12px; border: 1.5px solid #222; font-size: 11px; line-height: 1; }
.form-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
.form-table th { background: #6aa84f; color: #fff; text-align: left; padding: 4px 6px; font-weight: 700; }
.form-table td { border: 1px solid #9e9e9e; padding: 3px 6px; vertical-align: top; }
.form-table .qty { width: 42px; text-align: center; }
.form-table .notes { width: 38%; }
.form-table .done { width: 72px; text-align: center; }
.equip-cell { padding: 0; border: 0; }
.equip-line { display: grid; grid-template-columns: 1fr 42px 1.1fr; }
.equip-line span { border: 1px solid #9e9e9e; min-height: 18px; padding: 2px 6px; }
.outlet { border: 1px solid #9e9e9e; border-top: 0; padding: 2px 6px; font-weight: 700; font-size: 10px; }
.verify, .wo { display: flex; justify-content: space-between; gap: 12px; margin: 4px 0 8px; font-size: 11px; font-weight: 700; }
.signoff { margin-top: 10px; border: 2px solid #111; }
.sign-title { margin: 0; background: #111; color: #fff; text-align: center; font-weight: 800; letter-spacing: 0.08em; padding: 4px; }
.sign-grid { display: grid; grid-template-columns: 1fr 1.2in; gap: 8px 12px; padding: 8px; font-size: 12px; }
.sign-grid .date-box { grid-column: 2; grid-row: 1 / span 2; border: 1px solid #222; padding: 6px; }
.line { display: inline-block; min-width: 1.6in; border-bottom: 1px solid #222; }
.line.sign { min-width: 1.2in; }
.page-two { break-before: page; }
@media print {
  body * { visibility: hidden; }
  #install-form, #install-form * { visibility: visible; }
  #install-form { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { size: letter; margin: 0.4in; }
}
`;
