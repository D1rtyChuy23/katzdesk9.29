/**
 * Install Board chips and the empty state (UI only). The Prep and Installed counts are every
 * install in that lane. My View, the rep filter, AK and search narrow the list under them.
 */

export type InstallNarrow = {
  mine: boolean;
  rep: boolean;
  ak: boolean;
  search: boolean;
};

export function installNarrowed(f: InstallNarrow): boolean {
  return f.mine || f.rep || f.ak || f.search;
}

/** "Prep (25)" when nothing narrows the list, "Prep (0 of 25)" when something does. "—" until the list has loaded. */
export function installChip(label: "Prep" | "Installed", shown: number, total: number, narrowed: boolean, loaded: boolean): string {
  if (!loaded) return `${label} (—)`;
  if (!narrowed) return `${label} (${total})`;
  return `${label} (${shown} of ${total})`;
}

/**
 * What is hiding the lane, or null when the filters aren't the reason the list is empty.
 * My View is named on its own. A rep, AK or a search is named the same way, joined when more than one is on.
 */
export function installHiddenMessage(lane: "prep" | "installed", f: InstallNarrow): string | null {
  if (!installNarrowed(f)) return null;
  const place = lane === "prep" ? "in prep" : "marked installed";
  const bits = [
    f.mine ? "My View (you're not the rep or tech on any)" : null,
    f.rep ? "this rep" : null,
    f.ak ? "AK" : null,
    f.search ? "your search" : null,
  ].filter((b): b is string => !!b);
  if (bits.length === 1 && f.mine) return `No installs ${place} match My View (you're not the rep or tech on any).`;
  return `No installs ${place} match ${bits.join(" / ")}.`;
}

/** Show all: My View, the rep filter, AK and the search are off. Ready / Not ready are not these filters. */
export function clearedInstallNarrow(): InstallNarrow & { repValue: string; akOnly: boolean; q: string; mineOn: boolean } {
  return { mine: false, rep: false, ak: false, search: false, repValue: "", akOnly: false, q: "", mineOn: false };
}
