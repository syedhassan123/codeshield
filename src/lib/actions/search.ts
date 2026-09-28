"use server";

import { requireSession } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { searchWorkspace } from "@/lib/search/queries";

export async function searchWorkspaceAction(rawQuery: unknown) {
  const op = createServerOp({
    domain: "SEARCH",
    operation: "WORKSPACE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    op.allowed({ action: "search_workspace", role: session.user.role });

    const query = typeof rawQuery === "string" ? rawQuery : "";
    await connectDB();
    const results = await searchWorkspace({
      role: session.user.role,
      userId: session.user.id,
      query,
    });

    return op.respond({ results });
  } catch (error) {
    return op.respondError(error);
  }
}
