/** Save a file the browser already has (a Blob) as a download. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Save text as a CSV download in the browser. */
export function downloadCsv(name: string, csv: string) {
  downloadBlob(name, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
