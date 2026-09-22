/** Single source of truth for prep vs installed. */

export function isInstalled(row: {
  complete?: boolean | null;
  equipStatus?: string | null;
}): boolean {
  return !!row.complete || row.equipStatus === "Installed";
}

export function isOpenInstall(row: {
  complete?: boolean | null;
  equipStatus?: string | null;
}): boolean {
  return !isInstalled(row);
}

export function installedPatch(
  row: { installDate?: string | null } | undefined,
  today: string,
) {
  return {
    equipStatus: "Installed",
    complete: true as const,
    completedAt: today,
    installDate: row?.installDate || today,
  };
}
