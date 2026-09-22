import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PrefsProvider, usePrefs } from "@/components/desk/prefs-provider";
import { MyViewProvider } from "@/components/desk/my-view-bar";

import { resolvedDark } from "@/lib/ops/prefs";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 8_000, retry: 1, refetchOnWindowFocus: false },
        },
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
  return (
    <Toaster
      position="bottom-right"
      richColors
      theme={resolvedDark(prefs.appearance) ? "dark" : "light"}
    />
  );
}