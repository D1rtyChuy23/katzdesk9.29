const KEY = "katz-desk-invite";

export function rememberInviteToken(token: string | null | undefined) {
  if (typeof window === "undefined") return;
  const value = token?.trim();
  if (!value) return;
  try {
    window.sessionStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

export function readInviteToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    if (fromUrl?.trim()) {
      window.sessionStorage.setItem(KEY, fromUrl.trim());
      return fromUrl.trim();
    }
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearInviteToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
