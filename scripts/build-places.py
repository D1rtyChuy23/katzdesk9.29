#!/usr/bin/env python3
"""
Builds src/lib/ops/places-tiles/*.tsv: the Map's Prospects (Chuy, 11/27). Public data only, no customer data.

Source: the Overture Maps places theme (Overture Maps Foundation, CDLA Permissive 2.0; it includes OpenStreetMap). The
release is read straight from Overture's public bucket with HTTP range requests, so only the parts of each file that
cover Texas are downloaded (about 300 MB). Needs Python 3 with pyarrow (pip install pyarrow).

    python3 scripts/build-places.py                      # newest release
    python3 scripts/build-places.py --release 2026-11-18.0
    python3 scripts/build-places.py --save tx-raw.parquet  # also keep the downloaded rows
    python3 scripts/build-places.py --from tx-raw.parquet  # rebuild from them without downloading again
    python3 scripts/build-places.py --if-newer --summary summary.md  # what .github/workflows/refresh-prospects.yml runs

The release the files came from is kept in src/lib/ops/places-tiles/release.txt. --if-newer stops (and changes
nothing) when that is already the newest release; --summary writes what changed (places added and dropped, by type)
as Markdown, for the pull request.

Kept: places in Texas (address region US-TX or TX) of the types below, not marked permanently closed, with Overture's
confidence of at least MIN_CONFIDENCE. Columns (tab separated, header first) match PLACE_TILE_COLUMNS in
src/lib/ops/places.ts. One file per 1° square, named by its south-west corner: 29_-96.tsv is 29–30°N, 96–95°W.
"""
import argparse, io, math, os, re, sys, urllib.parse, urllib.request
from collections import defaultdict

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

BUCKET = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/"
WEST, EAST, SOUTH, NORTH = -106.65, -93.5, 25.8, 36.5  # Texas, with the parts of its neighbors the box takes in
MIN_CONFIDENCE = 0.55
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "ops", "places-tiles")
# status: "" for open, "closed" for a place Overture marks permanently closed. Closed places are never prospects; they
# are kept so the Address Report's Web Check can tell when one of our customers has closed.
COLUMNS = ["id", "name", "category", "kind", "lat", "lng", "street", "city", "zip", "phone", "website", "brand", "confidence", "status"]

# Overture basic categories worth reading; the finer taxonomy decides the type (category_of).
BASIC = {
    "restaurant", "casual_eatery", "coffee_shop", "cafe", "fast_food_restaurant", "bar", "brewery", "winery", "lodging",
    "hotel", "resort", "college_university", "hospital", "movie_theater", "food_and_beverage_store", "convenience_store",
    "gas_station", "auto_dealer", "corporate_or_business_office", "senior_living_facility", "non_alcoholic_beverage_venue",
    "professional_service",
}
BAKERY = {"bakery", "donut_shop", "bagel_shop", "cupcake_shop", "kolache_shop"}
EATERY_RESTAURANT = {"sandwich_shop", "diner", "delicatessen", "gastropub", "casual_eatery", "breakfast_and_brunch_restaurant"}
TEA = {"bubble_tea_shop", "tea_room", "tea_house", "teahouse"}
LODGING = {"lodging", "hostel", "service_apartment"}  # not "lodge": in Texas that is mostly Masonic and Elks lodges
NOT_CAFE = {"internet_cafe", "dog_cafe", "animal_cafe", "cat_cafe"}


# Fast-food chains Overture files as restaurants or sandwich shops: Fast Food, not Restaurants (a national chain buys
# coffee and service by contract, not from a local rep). Matched at the start of the name or brand, lower case.
FAST_FOOD_CHAINS = (
    "subway", "mcdonald", "burger king", "wendy's", "whataburger", "taco bell", "sonic drive", "jack in the box", "chick-fil-a",
    "popeyes", "kfc", "church's", "domino's", "pizza hut", "little caesars", "papa john", "arby's", "dairy queen", "raising cane",
    "jersey mike", "jimmy john", "firehouse subs", "panda express", "chipotle", "wingstop", "del taco", "carl's jr", "taco cabana",
    "schlotzsky", "potbelly", "quiznos", "long john silver", "golden chick", "chicken express", "freddy's", "smashburger",
)
# Names that are not the place type they are filed under.
LODGE_HALL = r"masonic|elks|moose|odd fellows|knights of columbus|a\.?\s?f\.? ?& ?a\.?\s?m|lodge\s+(no\.?\s*|#\s*)?\d+"
NOT_HOTEL = re.compile(rf"\b({LODGE_HALL}|residence hall|dormitory|hunting( ranch| lodge| lease)?)\b", re.I)
NOT_OFFICE = re.compile(rf"\b({LODGE_HALL}|smoke|vape|tobacco|wireless|boost mobile|cricket|metro by t-mobile|cell ?phone)\b", re.I)
# A doctor or nurse listed by name ("Gustavo Garcia, MD"): a person, not a hospital or clinic.
PERSON_TITLE = re.compile(r",?\s+(m\.?d|d\.?o|n\.?p|f\.?n\.?p(-c)?|p\.?a(-c)?|d\.?p\.?m|d\.?d\.?s|d\.?m\.?d|ph\.?d|r\.?n)\.?$", re.I)
# "Victor H Portillo": two or three capitalized words, maybe a middle initial; with no phone, website or brand, likely a
# person's registration filed as a business.
PERSON_NAME = re.compile(r"^[A-Z][a-z]+( [A-Z]\.?)?( [A-Z][a-z]+){1,2}$")
TX_ZIP = re.compile(r"^(7[5-9]\d{3}|885\d{2}|733\d{2})$")


def chain_of(name, brand):
    n = f"{name} {brand or ''}".lower().replace("’", "'")
    return any(n.startswith(c) or (brand or "").lower().replace("’", "'").startswith(c) for c in FAST_FOOD_CHAINS)


def category_of(basic, tax):
    """Our type for an Overture place, or None to leave it out."""
    tax = tax or basic
    if basic in ("coffee_shop", "cafe"):
        return None if tax in NOT_CAFE else "coffee"
    if basic == "non_alcoholic_beverage_venue":
        return "coffee" if tax in TEA else None
    if basic == "casual_eatery":
        return "bakery" if tax in BAKERY else "restaurant" if tax in EATERY_RESTAURANT else None
    if basic == "restaurant":
        return "restaurant"
    if basic == "fast_food_restaurant":
        return "fastfood"
    if basic in ("bar", "brewery", "winery"):
        return "bar"
    if basic in ("hotel", "resort"):
        return "hotel"
    if basic == "lodging":
        return "hotel" if tax in LODGING else None
    if basic == "college_university":
        return "college"
    if basic == "hospital":
        return "hospital"
    if basic == "movie_theater":
        return "cinema"
    if basic == "food_and_beverage_store":
        return "grocery" if re.search(r"grocery|supermarket", tax) else "bakery" if tax in BAKERY else None
    if basic in ("convenience_store", "gas_station"):
        return None if tax == "fuel_dock" else "convenience"
    if basic == "auto_dealer":
        return "cardealer"
    if basic == "corporate_or_business_office":
        return "office"
    if basic == "professional_service":
        return "office" if tax == "coworking_space" else None
    if basic == "senior_living_facility":
        return "senior"
    return None


GENERIC_KIND = {"restaurant", "coffee_shop", "cafe", "hotel", "lodging", "hospital", "college_university", "bar", "fast_food_restaurant",
                "convenience_store", "gas_station", "auto_dealer", "corporate_or_business_office", "movie_theater", "grocery_store",
                "senior_living_facility", "bakery"}


def kind_of(tax):
    """Overture's finer type in words ("mexican restaurant"), or "" when it says no more than our type does."""
    if not tax or tax in GENERIC_KIND:
        return ""
    return tax.replace("_", " ")


class HttpFile(io.RawIOBase):
    """A read-only, seekable file over HTTP range requests (through HTTPS_PROXY when one is set)."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        if n == 0 or self.pos >= self.size:
            return b""
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{min(self.size, self.pos + n) - 1}"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                break
            except Exception:
                if attempt == 3:
                    raise
        self.pos += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


def list_keys(prefix):
    keys, token = [], None
    while True:
        q = f"?list-type=2&prefix={urllib.parse.quote(prefix)}" + (f"&continuation-token={urllib.parse.quote(token)}" if token else "")
        x = urllib.request.urlopen(BUCKET + q, timeout=60).read().decode()
        keys += re.findall(r"<Key>([^<]+\.parquet)</Key>", x)
        m = re.search(r"<NextContinuationToken>([^<]+)</NextContinuationToken>", x)
        if not m:
            return keys
        token = m.group(1)


def newest_release():
    x = urllib.request.urlopen(BUCKET + "?list-type=2&prefix=release/&delimiter=/", timeout=60).read().decode()
    return sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", x))[-1]


def download(release):
    """The Texas rows of the release's places, with the columns the files need."""
    keys = list_keys(f"release/{release}/theme=places/type=place/")
    cols = ["id", "names", "basic_category", "taxonomy", "confidence", "operating_status", "websites", "phones", "addresses", "bbox", "brand"]
    out = []
    for k in keys:
        pf = pq.ParquetFile(HttpFile(BUCKET + k))
        md = pf.metadata
        paths = [md.schema.column(i).path for i in range(md.num_columns)]
        ix = {p: paths.index(p) for p in ("bbox.xmin", "bbox.xmax", "bbox.ymin", "bbox.ymax")}
        for g in range(md.num_row_groups):
            st = {p: md.row_group(g).column(i).statistics for p, i in ix.items()}
            if not (st["bbox.xmin"].min <= EAST and st["bbox.xmax"].max >= WEST and st["bbox.ymin"].min <= NORTH and st["bbox.ymax"].max >= SOUTH):
                continue
            tb = pf.read_row_group(g, columns=cols)
            x, y = pc.struct_field(tb.column("bbox"), "xmin"), pc.struct_field(tb.column("bbox"), "ymin")
            keep = pc.and_(
                pc.and_(pc.and_(pc.greater_equal(x, WEST), pc.less_equal(x, EAST)), pc.and_(pc.greater_equal(y, SOUTH), pc.less_equal(y, NORTH))),
                pc.is_in(tb.column("basic_category"), value_set=pa.array(sorted(BASIC))),
            )
            sub = tb.filter(keep)
            if sub.num_rows:
                out.append(pa.table({
                    "id": sub.column("id"),
                    "name": pc.struct_field(sub.column("names"), "primary"),
                    "basic": sub.column("basic_category"),
                    "tax": pc.struct_field(sub.column("taxonomy"), "primary"),
                    "conf": sub.column("confidence"),
                    "status": sub.column("operating_status"),
                    "web": sub.column("websites"),
                    "phones": sub.column("phones"),
                    "addresses": sub.column("addresses"),
                    "x": pc.struct_field(sub.column("bbox"), "xmin"),
                    "y": pc.struct_field(sub.column("bbox"), "ymin"),
                    "brand": pc.struct_field(pc.struct_field(sub.column("brand"), "names"), "primary"),
                }))
        print(f"{k.rsplit('/', 1)[-1][:40]}: {sum(t.num_rows for t in out)} rows so far", file=sys.stderr, flush=True)
    return pa.concat_tables(out)


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def first(xs):
    return xs[0] if xs else None


def read_current():
    """The open places in the files now: id → (type, name, city). Empty when there are none yet."""
    out = {}
    if not os.path.isdir(OUT):
        return out
    for f in os.listdir(OUT):
        if not f.endswith(".tsv"):
            continue
        with open(os.path.join(OUT, f), encoding="utf-8") as fh:
            next(fh, None)
            for line in fh:
                c = line.rstrip("\n").split("\t")
                if len(c) >= 13 and (len(c) < 14 or c[13] != "closed"):
                    out[c[0]] = (c[2], c[1], c[7])
    return out


def write_tiles(table, before=None, min_share=0.0):
    """
    Writes the files; returns the places written, id → (type, name, city), what was left out and why, and the ids
    Overture marks permanently closed. Refuses (writing nothing) when it would keep fewer than `min_share` of `before`:
    a release still being uploaded, or a broken download, must not shrink the list.
    """
    tiles, kept, why, closed_ids = defaultdict(list), 0, defaultdict(int), set()
    seen, same = set(), set()
    # Surest first, so when Overture lists one place twice (same name, street and type) the surer copy is kept.
    for r in sorted(table.to_pylist(), key=lambda r: -(r["conf"] or 0)):
        cat = category_of(r["basic"], r["tax"])
        if not cat:
            why["type"] += 1; continue
        closed = r["status"] == "permanently_closed"
        if (r["conf"] or 0) < MIN_CONFIDENCE:
            why["unsure"] += 1; continue
        a = first(r["addresses"] or []) or {}
        # Overture writes the state as "US-TX" (most places) or "TX".
        if (a.get("region") or "").upper() not in ("US-TX", "TX") or (a.get("country") or "US").upper() != "US":
            why["not TX"] += 1; continue
        name = clean(r["name"])
        if not name:
            why["no name"] += 1; continue
        phone, web, brand = clean(first(r["phones"] or [])), clean(first(r["web"] or [])), clean(r["brand"])
        if cat == "restaurant" and chain_of(name, brand):
            cat = "fastfood"
        if (cat == "hotel" and NOT_HOTEL.search(name)) or (cat == "office" and NOT_OFFICE.search(name)) or (cat == "hospital" and PERSON_TITLE.search(name)):
            why["not that type"] += 1; continue
        if cat in ("hotel", "office") and PERSON_NAME.match(name) and not (phone or web or brand):
            why["a person's name"] += 1; continue
        zip_raw = clean(a.get("postcode"))[:5]
        if zip_raw and not TX_ZIP.match(zip_raw):
            why["not a Texas ZIP"] += 1; continue
        dup = (name.lower(), clean(a.get("freeform")).lower(), cat, closed)
        if dup in same:
            why["listed twice"] += 1; continue
        same.add(dup)
        pid = (r["id"] or "").replace("-", "")[:12]
        if not pid or pid in seen:
            why["id"] += 1; continue
        seen.add(pid)
        zip5 = re.match(r"\d{5}", clean(a.get("postcode")))
        row = [pid, name, cat, kind_of(r["tax"]), f"{r['y']:.5f}", f"{r['x']:.5f}", clean(a.get("freeform")), clean(a.get("locality")).title(),
               zip5.group(0) if zip5 else "", phone, web, brand, f"{r['conf']:.2f}", "closed" if closed else ""]
        row = [c.replace("\t", " ") for c in row]
        # The square from the written (rounded) numbers, so a place at 32.999996°N, written 33.00000, files under 33.
        tiles[f"{math.floor(float(row[4]))}_{math.floor(float(row[5]))}"].append(row)
        if closed:
            why["closed (kept, flagged)"] += 1
            closed_ids.add(pid)
        else:
            kept += 1
    if before and kept < min_share * len(before):
        sys.exit(f"Refusing: only {kept:,} places, against {len(before):,} now (less than {min_share:.0%}). Overture may still be uploading this release; try again later, or pass --allow-shrink.")
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".tsv"):
            os.remove(os.path.join(OUT, f))
    for key, rows in tiles.items():
        rows.sort(key=lambda c: (c[2], c[1].lower(), c[0]))
        with open(os.path.join(OUT, f"{key}.tsv"), "w", encoding="utf-8", newline="\n") as fh:
            fh.write("\t".join(COLUMNS) + "\n")
            for row in rows:
                fh.write("\t".join(row) + "\n")
    print(f"{kept} open places (and {len(closed_ids)} closed ones, flagged) in {len(tiles)} files; other counts: {dict(why)}", file=sys.stderr)
    return {row[0]: (row[2], row[1], row[7]) for rows in tiles.values() for row in rows if row[13] != "closed"}, dict(why), closed_ids


LABELS = {
    "coffee": "Coffee Shops & Cafés", "bakery": "Bakeries & Donuts", "restaurant": "Restaurants", "hotel": "Hotels",
    "college": "Colleges & Universities", "office": "Corporate Offices", "senior": "Senior Living", "hospital": "Hospitals & Clinics",
    "cinema": "Movie Theaters", "bar": "Bars", "fastfood": "Fast Food", "grocery": "Grocery Stores", "convenience": "Convenience & Gas",
    "cardealer": "Car Dealerships",
}


def summary(old_release, release, before, after, why, closed_ids):
    """Markdown for the pull request: totals by type, and a sample of what came and went."""
    added = [i for i in after if i not in before]
    dropped = [i for i in before if i not in after]
    closed = [i for i in dropped if i in closed_ids]
    lines = [
        f"Prospects refreshed from Overture release **{release}** (was {old_release or 'none recorded'}).",
        "",
        f"- **{len(after):,}** places now (was {len(before):,}): **{len(added):,} added**, **{len(dropped):,} dropped**"
        f" ({len(closed):,} of them now marked permanently closed by Overture; the rest left its listings, changed type or fell below the bar).",
        f"- Not prospects this time: {', '.join(f'{k} {v:,}' for k, v in sorted(why.items()))}.",
        "",
        "| Type | Before | Now | Added | Dropped |",
        "|---|---:|---:|---:|---:|",
    ]
    # A place that stayed but changed type counts as dropped from the old type and added to the new one, so each row
    # adds up: Before + Added - Dropped = Now.
    moved = [i for i in after if i in before and after[i][0] != before[i][0]]
    for cat, label in LABELS.items():
        b = sum(1 for v in before.values() if v[0] == cat)
        a = sum(1 for v in after.values() if v[0] == cat)
        ad = sum(1 for i in added if after[i][0] == cat) + sum(1 for i in moved if after[i][0] == cat)
        dr = sum(1 for i in dropped if before[i][0] == cat) + sum(1 for i in moved if before[i][0] == cat)
        lines.append(f"| {label} | {b:,} | {a:,} | {ad:,} | {dr:,} |")
    if moved:
        lines.append(f"\n{len(moved):,} places stayed but changed type; the table counts them in both rows.")

    def code(text):
        # Names come from the data: as code text they cannot mention anyone, link anywhere or format the page.
        return "`" + re.sub(r"[`\r\n]", "", text or "")[:80] + "`"

    def sample(ids, src, n=15):
        return [f"  - {code(src[i][1])} ({LABELS.get(src[i][0], src[i][0])}, {code(src[i][2] or 'no city')})" for i in sorted(ids)[:n]]
    if added:
        lines += ["", f"Some of the places added ({min(15, len(added))} of {len(added):,}):", *sample(added, after)]
    if closed:
        lines += ["", f"Some of the places now closed ({min(15, len(closed))} of {len(closed):,}):", *sample(closed, before)]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--release", help="Overture release, e.g. 2026-11-18.0 (default: the newest)")
    ap.add_argument("--from", dest="src", nargs="*", help="parquet files an earlier run wrote with --save, instead of downloading")
    ap.add_argument("--save", help="also write the downloaded rows to this parquet file")
    ap.add_argument("--if-newer", action="store_true", help="do nothing when the files already come from this release")
    ap.add_argument("--print-newest", action="store_true", help="print the newest Overture release and stop")
    ap.add_argument("--allow-shrink", action="store_true", help="write the files even if they would hold under 90%% of the places now")
    ap.add_argument("--summary", help="write what changed, as Markdown, to this file")
    args = ap.parse_args()
    if args.print_newest:
        print(newest_release())
        return
    release_file = os.path.join(OUT, "release.txt")
    old_release = open(release_file).read().strip() if os.path.exists(release_file) else ""
    release = ""
    if args.src:
        table = pa.concat_tables([pq.read_table(p) for p in args.src], promote_options="default")
    else:
        release = args.release or newest_release()
        if args.if_newer and release == old_release:
            print(f"The places already come from Overture release {release}: nothing to do.", file=sys.stderr)
            return
        print(f"Overture release {release}", file=sys.stderr)
        table = download(release)
        if args.save:
            pq.write_table(table, args.save)
    before = read_current()
    after, why, closed_ids = write_tiles(table, before, 0.0 if args.allow_shrink else 0.9)
    if release:
        with open(release_file, "w") as fh:
            fh.write(release + "\n")
    if args.summary:
        with open(args.summary, "w", encoding="utf-8") as fh:
            fh.write(summary(old_release, release or "(local files)", before, after, why, closed_ids))


if __name__ == "__main__":
    main()
