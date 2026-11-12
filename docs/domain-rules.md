# KatzDesk domain rules

The business rules KatzDesk data must follow, and the files no agent may break. Read this before changing anything
that touches equipment, customers, serials, imports or publishing. When code and this file disagree, ask Chuy which is
right. Don't quietly change either one. Settled questions go in docs/decisions.md.

## 1. Never invent data
- A model, part number (MPN), serial, account number or price that the source doesn't support stays blank and gets a
  flag. Never fill it in with a best guess.
- A suggestion is labeled as a suggestion, with the reason beside it ("208V on the unit matches the 240V part"). It
  never becomes confirmed on its own.
- Only Chuy confirms. A value Chuy entered or confirmed outranks every import. An import that disagrees with it is
  shown as a conflict and is never written over it.

## 2. Sources of truth
| Field | Authority | Code that owns it |
| --- | --- | --- |
| Customer name and account number | NetSuite customer export | clean-names.ts, netsuite-customers.ts, customer-identity.ts |
| Work orders and their status | Corrigo export | corrigo.ts, corrigo-import.ts |
| Model spelling | The Ready Equipment Log naming, as the desk's catalog | equipment.ts |
| Item code to model and MPN | Equipment codes file, MPN only with a source | equipment-codes.ts, mpn-rules.ts |
| Spec sheets, manuals, parts books | Manufacturer source, tied to one MPN | library-file-rules.ts, mpn-rules.ts |
| Legacy (discontinued) models | Manufacturer source only | legacy-rules.ts |

When two sources disagree, the authority wins and the other value is kept where it can be seen, not deleted.

## 3. Equipment names
- One model, one spelling: the catalog name. A typed variant ("Bunn ITCB-DV, 29 in. w/Flip Tray") counts to its catalog
  model. The suffix stays on the line as a note, never as a second machine.
- A customer or location tag in a name, such as "(Coco's)" or "(Front Lobby)", is not part of the model. The unit still
  counts to its model, and the tag is kept.
- A name the catalog doesn't know still counts. It shows up as unmatched so Chuy can name it. It never drops out of a
  total.
- Spreadsheet rule, not yet in the app: Bunn ITCB and ITB units with "(NS)" in the name are counted separately from the
  non-NS units. See the open question in docs/decisions.md before building it in.

## 4. Serials
- Two serials are the same when they read the same after trimming spaces and "#" (serialKey in duplicate-serials.ts).
- Near matches (dashes, dots, an "SN" prefix, leading zeros) are flagged for a look and never merged on their own.
- A duplicate serial is flagged, never silently dropped or merged.

## 5. Totals
- Every count is live from the records. No totals are typed in.
- Every total has a catch-all for unmatched rows, so the grand total always equals the number of records counted.

## 6. Publishing files (Grok/Vercel): don't break these
Grok's full contract is in AGENTS.md. These are the parts a builder outside Grok is most likely to break:
- **startup.sh** stays at the repo root, stays POSIX sh, and starts the dev server on 0.0.0.0:8080. Don't delete it.
- **vite.config.ts**: keep the dev port (0.0.0.0:8080), the preview port (127.0.0.1:8081), the nitro plugin with
  `preset: "vercel"` and `serverDir: "./server"`, gated to build and preview, and `grokPwaPlugin()`.
- **public/__grok/, server/, scripts/grok-pwa-*** are the Home Screen install chrome. Don't delete or overwrite them.
  New server routes go in src/routes/, never in server/.
- **migrations/0001_auth.sql** is the Better Auth schema, and **src/lib/auth/server.ts** is not rewritten. Schema
  changes are new numbered files in migrations/.
- No **.env** file. The preview needs none, and the platform injects DATABASE_URL on deploy.
