import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearPartImage, setPartBin, setPartClass, setPartDescription, setPartImage, setPartMpn, type PartRow } from "@/lib/ops/parts-api";
import { BIN_PIECES, binText, cleanBinValue, type BinValues } from "@/lib/ops/part-bins";
import { treatPartPhoto, treatResearchedPhoto } from "@/lib/part-photo-treatment";

/*
 * The state and saves behind the part edits on Parts (photo, MPN, part name, bin location, class), used by both the
 * row and the part's window through the pieces in part-controls.tsx.
 */

type Changed = () => void;

export const partMoney = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export type PartPhoto = ReturnType<typeof usePartPhoto>;

/** Add, replace, remove, pull the confirmed photo, and review researched photos. */
export function usePartPhoto(row: PartRow, onChanged: Changed) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const pull = useMutation({
    mutationFn: async () => setPartImage({ data: { id: row.id, base64: await treatResearchedPhoto(row.id, -1), sourceUrl: row.research?.imageUrl ?? null } }),
    onSuccess: () => {
      toast.success("Confirmed photo attached");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not get the photo; it stays flagged Confirm Photo"),
  });
  const upload = useMutation({
    // Same treatment as a researched photo: trimmed, centered on the light square.
    mutationFn: async (file: File) => setPartImage({ data: { id: row.id, base64: await treatPartPhoto(file) } }),
    onSuccess: () => {
      toast.success(row.hasImage ? "Photo replaced" : "Photo added");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the photo"),
  });
  const remove = useMutation({
    mutationFn: () => clearPartImage({ data: { id: row.id } }),
    onSuccess: () => {
      toast.success("Photo removed");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the photo"),
  });
  return { fileRef, reviewing, setReviewing, pull, upload, remove };
}

export type PartMpnEdit = ReturnType<typeof usePartMpnEdit>;

/** The manufacturer part number (shown as Part #). Admin and Sales. Blank clears it. */
export function usePartMpnEdit(row: PartRow, onChanged: Changed) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.mpn ?? "");
  useEffect(() => setValue(row.mpn ?? ""), [row.mpn]);
  const save = useMutation({
    mutationFn: () => setPartMpn({ data: { id: row.id, mpn: value.trim() || null } }),
    onSuccess: () => {
      setEditing(false);
      toast.success("MPN saved");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the MPN"),
  });
  return { editing, setEditing, value, setValue, save };
}

export type PartNameEdit = ReturnType<typeof usePartNameEdit>;

/**
 * The part's name: the NetSuite Description, as typed on Parts. Admin and Sales. Blank clears it; nothing is filled
 * in for a part that has none.
 */
export function usePartNameEdit(row: PartRow, onChanged: Changed) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.description ?? "");
  useEffect(() => setValue(row.description ?? ""), [row.description]);
  const save = useMutation({
    mutationFn: () => setPartDescription({ data: { id: row.id, description: value.trim() || null } }),
    onSuccess: () => {
      setEditing(false);
      toast.success(value.trim() ? "Description saved" : "Description cleared");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the description"),
  });
  const cancel = () => {
    setValue(row.description ?? "");
    setEditing(false);
  };
  return { editing, setEditing, value, setValue, save, cancel };
}

export type PartBinEdit = ReturnType<typeof usePartBinEdit>;
export type BinDraft = Record<(typeof BIN_PIECES)[number], string>;

export const binDraft = (v: BinValues): BinDraft => ({ rack: v.rack ?? "", shelf: v.shelf ?? "", bin: v.bin ?? "" });

/**
 * The bin location: Rack, Shelf and Bin. Admin only for now (Chuy, 10/28). The boxes start with what is stored, so
 * a move is typing over them; a blank box clears that piece.
 */
export function usePartBinEdit(row: PartRow, onChanged: Changed) {
  const stored: BinValues = { rack: row.binRack, shelf: row.binShelf, bin: row.binBin };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BinDraft>(() => binDraft(stored));
  useEffect(() => setDraft(binDraft({ rack: row.binRack, shelf: row.binShelf, bin: row.binBin })), [row.binRack, row.binShelf, row.binBin]);
  const dirty = BIN_PIECES.some((k) => cleanBinValue(draft[k]) !== stored[k]);
  const save = useMutation({
    mutationFn: () => setPartBin({ data: { id: row.id, rack: draft.rack, shelf: draft.shelf, bin: draft.bin } }),
    onSuccess: (p) => {
      setEditing(false);
      const now = binText({ rack: p.binRack, shelf: p.binShelf, bin: p.binBin });
      toast.success(now ? `Bin location saved: ${now}` : "Bin location cleared");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the bin location"),
  });
  const setPiece = (k: keyof BinDraft, value: string) => setDraft((d) => ({ ...d, [k]: value }));
  const cancel = () => {
    setDraft(binDraft(stored));
    setEditing(false);
  };
  return { editing, setEditing, draft, setPiece, dirty, save, cancel };
}

export type PartClassEdit = ReturnType<typeof usePartClassEdit>;

/**
 * The part's Class, picked from the five. Admin only for now (Chuy, 10/28). Saves as soon as one is picked; the
 * pick shows at once and goes back if the save fails.
 */
export function usePartClassEdit(row: PartRow, onChanged: Changed) {
  const [value, setValue] = useState(row.itemClass ?? "");
  useEffect(() => setValue(row.itemClass ?? ""), [row.itemClass]);
  const save = useMutation({
    mutationFn: (next: string) => setPartClass({ data: { id: row.id, itemClass: next || null } }),
    onSuccess: (p) => {
      toast.success(p.itemClass ? `Class changed to ${p.itemClass}` : "Class cleared");
      onChanged();
    },
    onError: (e) => {
      setValue(row.itemClass ?? "");
      toast.error(e instanceof Error ? e.message : "Could not change the class");
    },
  });
  const pick = (next: string) => {
    if (next === (row.itemClass ?? "")) return;
    setValue(next);
    save.mutate(next);
  };
  return { value, pick, save };
}
