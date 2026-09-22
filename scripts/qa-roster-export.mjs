import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
mkdirSync("/workspace/artifacts", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(`page: ${e}`));
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function signIn(page, username) {
  const email = `${username}@katz.test`;
  const pass = "DeskRoster99!";
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const createToggle = page.getByRole("button", { name: /Need an account|Create one/i });
  if (await createToggle.count()) await createToggle.click();
  await page.locator("#username").fill(username);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(5000);
}

try {
  const page = await newPage();
  const stamp = Date.now().toString(36).slice(-4);
  await signIn(page, `chuy.rstr${stamp}`);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const body = await page.locator("main").innerText();
  if (!/Service tech roster/i.test(body)) {
    throw new Error(`Roster editor missing for owner login: ${body.slice(0, 400)}`);
  }
  if (!/\bJesus\b/.test(body)) throw new Error("Jesus missing from roster");
  if (!/Elias \(inactive\)/i.test(body)) {
    throw new Error("Elias should be listed as inactive, not removed from history");
  }
  await shot(page, "roster-editor");

  await page.goto(`${BASE}/service`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const assignFilter = page.getByLabel("Filter by technician");
  const filterText = await assignFilter.innerText();
  if (/\bElias\b/.test(filterText) && !/inactive/i.test(filterText)) {
    throw new Error(`Elias still in active tech filter: ${filterText}`);
  }
  if (!/\bJesus\b/.test(filterText)) throw new Error(`Jesus missing from tech filter: ${filterText}`);

  const exportBtn = page.getByRole("button", { name: /^Export$/ }).first();
  await exportBtn.click();
  await page.getByRole("dialog").waitFor();
  const dlg = await page.getByRole("dialog").innerText();
  for (const label of ["Pending services", "PMs", "Modules", "TLC & Factors", "Install readiness"]) {
    if (!dlg.includes(label) && !(await page.getByRole("dialog").locator("option", { hasText: label }).count())) {
      throw new Error(`Missing report type ${label}: ${dlg.slice(0, 500)}`);
    }
  }
  await shot(page, "export-dialog");
  await page.locator("#export-type").selectOption("installs");
  await page.getByRole("button", { name: /^Preview$/ }).click();
  await page.waitForTimeout(2500);
  const preview = await page.getByRole("dialog").innerText();
  if (!/not ready/i.test(preview) || !/ready/i.test(preview)) {
    throw new Error(`Install preview missing counts: ${preview.slice(0, 800)}`);
  }
  if (!/Configuration/i.test(preview)) {
    throw new Error(`Install preview missing configuration column: ${preview.slice(0, 800)}`);
  }
  await shot(page, "export-install-preview");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /Download Excel/i }).click(),
  ]);
  const filename = download.suggestedFilename();
  if (!/KatzDesk-Install-readiness-.*\.xlsx/i.test(filename)) {
    throw new Error(`Unexpected filename ${filename}`);
  }
  const dest = `/workspace/artifacts/${filename}`;
  await download.saveAs(dest);
  writeFileSync("/workspace/artifacts/last-export-name.txt", filename);

  const wb = XLSX.read(readFileSync(dest));
  if (wb.SheetNames.join(",") !== "Not ready,Ready") {
    throw new Error(`Expected Not ready + Ready sheets, got ${wb.SheetNames.join(",")}`);
  }
  const notReady = XLSX.utils.sheet_to_json(wb.Sheets["Not ready"], { header: 1, defval: "" });
  const ready = XLSX.utils.sheet_to_json(wb.Sheets["Ready"], { header: 1, defval: "" });
  const headerBits = (notReady[0] || []).join(" ");
  if (!/Install readiness/i.test(headerBits)) throw new Error("Missing report type header");
  const generated = String((notReady[1] || [])[0] || "");
  if (!/Generated 20\d{2}-\d{2}-\d{2}/.test(generated)) {
    throw new Error(`Generated datetime not ISO: ${generated}`);
  }
  const colRow = notReady.find((r) => r[0] === "Account" && r[2] === "Configuration");
  if (!colRow) throw new Error(`Missing configuration column: ${JSON.stringify(notReady.slice(0, 8))}`);
  const dataStart = notReady.indexOf(colRow) + 1;
  const dataRows = notReady.slice(dataStart).filter((r) => r[0]);
  const readyCol = ready.find((r) => r[0] === "Account" && r[2] === "Configuration");
  const readyData = readyCol ? ready.slice(ready.indexOf(readyCol) + 1).filter((r) => r[0]) : [];
  if (!dataRows.length) throw new Error("Not ready sheet has no equipment rows");
  const accounts = dataRows.map((r) => r[0]);
  const sorted = [...accounts].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (accounts.join("\0") !== sorted.join("\0")) {
    throw new Error("Not ready sheet is not grouped by account");
  }
  const lastUpdatedIdx = colRow.indexOf("Last updated");
  const dates = dataRows.map((r) => r[lastUpdatedIdx]).filter(Boolean);
  if (dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(String(d)))) {
    throw new Error(`Last updated not ISO: ${dates.slice(0, 5)}`);
  }
  const cfg = dataRows.map((r) => r[2]).filter(Boolean);
  if (!cfg.length) throw new Error("Configuration column empty");
  writeFileSync(
    "/workspace/artifacts/install-readiness-summary.json",
    JSON.stringify(
      {
        filename,
        sheets: wb.SheetNames,
        notReady: dataRows.length,
        ready: readyData.length,
        sample: dataRows.slice(0, 6).map((r) => ({
          account: r[0],
          equipment: r[1],
          configuration: r[2],
          blocking: r[3],
          tech: r[4],
          updated: r[5],
        })),
      },
      null,
      2,
    ),
  );

  await page.goto(`${BASE}/installs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const inst = await page.locator("main").innerText();
  if (!/not ready/i.test(inst) || !/\bready\b/i.test(inst)) {
    throw new Error("Install board missing ready/not-ready counts");
  }
  if (!(await page.getByRole("button", { name: /Export readiness/i }).count())) {
    throw new Error("Export readiness missing on install board");
  }
  await shot(page, "install-counts");

  const other = await newPage();
  await signIn(other, `sales.rstr${stamp}`);
  await other.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await other.waitForTimeout(800);
  const otherBody = await other.locator("main").innerText();
  if (/Service tech roster/i.test(otherBody)) {
    throw new Error("Roster editor visible to a non-owner account");
  }
  await shot(other, "roster-hidden-nonowner");

  console.log(
    JSON.stringify({
      ok: true,
      filename,
      dest,
      notReady: dataRows.length,
      ready: readyData.length,
      errors,
    }),
  );
} catch (e) {
  const page = (await browser.contexts()[0]?.pages())?.[0];
  if (page) await shot(page, "roster-export-fail");
  console.error(e);
  console.log(JSON.stringify({ ok: false, error: String(e), errors }));
  process.exit(1);
} finally {
  await browser.close();
}
