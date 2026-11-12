# KatzDesk domain rules

How KatzDesk data behaves today, and the rules Chuy uses in his spreadsheets that the app doesn't follow yet. Read this
before changing anything that touches equipment, customers, serials, imports or publishing.

Part A describes the code as it is. If you change one of these behaviors, update Part A in the same PR. Part B lists
spreadsheet rules, not app behavior. Don't build one into the app until Chuy says so; record his answer in
docs/decisions.md. Settled questions go in docs/decisions.md.

## Part A: what the app does today

### 1. Imports and who saves
- Every import shows a preview first. Nothing is written until someone saves.
- Approving clean-list customer names is Admin-only (access.ts). Exact name matches are applied and locked right away
  (clean-names.ts). Similar names and names with no match wait for approval.
- The NetSuite customer import matches on the NetSuite Internal ID, then the exact account number, then the exact name,
  never fuzzy. It updates the ID, account number, addresses, contact and Inactive flag directly. It never renames an
  account, and a blank cell never clears a value (netsuite-customers.ts).
- A unit locked by the owner is never filled in or rewritten by an import (lockedBy in account-equip.ts).
- Never fill in a model, MPN, serial, account number or price that the source doesn't support. Leave it blank or show
  it as unmatched.

### 2. Where each field comes from
| Field | Source | Code that owns it |
| --- | --- | --- |
| Customer name, account number, addresses | NetSuite customer export, through the preview | netsuite-customers.ts, clean-names.ts, customer-identity.ts |
| Work orders and status | Corrigo export, except statuses the desk keeps (Installed never moves back) | corrigo.ts (CORRIGO_STATUS, boardStatus) |
| Equipment model catalog | The equipment directory plus models already on units | api.ts (catalogModels), equipment.ts |
| Matching an account unit to a model | Catalog match on the name and model typed | account-equip.ts (matchCatalogModel) |
| Item code to model and MPN | Equipment codes file. An MPN is set only with a source | equipment-codes.ts, mpn-rules.ts |
| Spec sheets, manuals, parts books | Manufacturer source, tied to one MPN | library-file-rules.ts, mpn-rules.ts |
| Legacy (discontinued) models | Manufacturer source only | legacy-rules.ts |

### 3. Equipment names
- Each model variation is its own model with its own spec sheet, never merged into a family. For example, Axiom DV-APS
  and Axiom Twin are two models. "Bunn ITCB-DV, 29" w/Flip Tray" is a catalog model of its own.
- A tag in parentheses, such as "(Coco's)" or "(Front Lobby)", is stripped before matching, so the unit still matches its
  model (account-equip.ts). That also strips "(NS)" today. See Part B.
- A row the import can't match to a catalog model, or that matches more than one, isn't saved. It stays unchecked until
  someone picks the account and the model.

### 4. Serials
- Two serials are the same when they read the same after trimming spaces and "#", ignoring letter case (serialKey in
  account-equip.ts). The duplicate report also drops "N/A"-type values and keys under 3 characters (dupKey in
  duplicate-serials.ts).
- Near matches (dashes, dots, an "SN" prefix, leading zeros) are flagged for a look and never merged on their own.
- The same serial on the same account is the same unit, and the import updates it. The same serial on another account
  goes to review (matchExistingUnit in account-equip.ts).

### 5. Publishing files (Grok/Vercel): don't break these
Grok's full contract is in AGENTS.md. These are the parts a builder outside Grok is most likely to break:
- **startup.sh** stays at the repo root, stays POSIX sh, and starts the dev server on 0.0.0.0:8080. Don't delete it.
- **vite.config.ts**: keep the dev port (0.0.0.0:8080), the preview port (127.0.0.1:8081), the nitro plugin with
  `preset: "vercel"` and `serverDir: "./server"`, gated to build and preview, and `grokPwaPlugin()`.
- **public/__grok/, server/, scripts/grok-pwa-*** are the Home Screen install chrome. Don't delete or overwrite them.
  New server routes go in src/routes/, never in server/.
- **migrations/0001_auth.sql** is the Better Auth schema, and **src/lib/auth/server.ts** is not rewritten. Schema
  changes are new numbered files in migrations/.
- No **.env** file. The preview needs none, and the platform injects DATABASE_URL on deploy.

## Part B: Chuy's spreadsheet rules (not in the app)
These come from the Equipment List, Master Asset List and Ready Equipment Log workbooks.
- Bunn ITCB and ITB units with "(NS)" in the name are counted apart from the non-NS units. The app strips "(NS)" today.
- The Ready Equipment Log spelling is the naming standard in the Master Asset List.
- A value Chuy confirmed is high confidence. A source that disagrees with it is flagged as a conflict, not written over
  it. Suggestions carry their reason, and only Chuy confirms them.
- Every total has a catch-all row for unmatched names, so the grand total always equals the number of records counted.
