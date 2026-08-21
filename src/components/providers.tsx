import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/provider";
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
        {children}
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}
