import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearPartImage, setPartDescription, setPartImage, setPartMpn, type PartRow } from "@/lib/ops/parts-api";
import { treatPartPhoto, treatResearchedPhoto } from "@/lib/part-photo-treatment";

/*
 * The state and saves behind the part edits on Parts (photo, MPN, part name), used by both the row and the part's
 * window through the pieces in part-controls.tsx.
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
