import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { QUERY_DEFAULTS, returnRefreshListener } from "@/lib/ops/return-refresh";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PrefsProvider, usePrefs } from "@/components/desk/prefs-provider";
import { MyViewProvider } from "@/components/desk/my-view-bar";
import { useToastsLifted } from "@/components/desk/toast-lift";

import { resolvedDark } from "@/lib/ops/prefs";
import { Toaster } from "sonner";

// The query library's own focus listener fires on every return to the tab; this one waits out a quick switch.
if (typeof window !== "undefined") focusManager.setEventListener(returnRefreshListener());

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // Lists read again on coming back to the tab after 30 seconds or more (site pass #7): return-refresh.ts.
        defaultOptions: { queries: { ...QUERY_DEFAULTS } },
      }),
  );
  return (
    <AuthProvider>
      <QueryClientProvider client={client}>
        <PrefsProvider>
          <MyViewProvider>
            {children}
            <ThemedToaster />
          </MyViewProvider>
        </PrefsProvider>

      </QueryClientProvider>
    </AuthProvider>
  );
}

function ThemedToaster() {
  const { prefs } = usePrefs();
  // Above a bar of buttons along the bottom (an install window's Save), never over it.
  const lifted = useToastsLifted();
  return (
    <Toaster
      position="bottom-right"
      richColors
      theme={resolvedDark(prefs.appearance) ? "dark" : "light"}
      offset={lifted ? { bottom: 84 } : undefined}
      mobileOffset={lifted ? { bottom: 88 } : undefined}
    />
  );
}