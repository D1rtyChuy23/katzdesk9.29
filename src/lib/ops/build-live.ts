import { createServerFn } from "@tanstack/react-start";
import { BUILD } from "@/lib/build-info";

/**
 * The commit the server is running now, for the "new version" notice. Open to anyone: the same commit is already in
 * the page's own script, and it must answer even when a session has lapsed.
 */
export const getLiveBuild = createServerFn({ method: "GET" }).handler(async (): Promise<{ sha: string }> => ({ sha: BUILD.sha }));
