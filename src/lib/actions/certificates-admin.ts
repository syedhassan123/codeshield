"use server";

import { revalidatePath } from "next/cache";
import { ActionError, requireAdmin } from "@/lib/auth-guards";
import {
  listAdminCertificates,
  reinstateCertificate,
  revokeCertificate,
} from "@/lib/certificates/admin-queries";
import { connectDB } from "@/lib/db";
import { createServerOp, maskId } from "@/lib/debug";
import {
  adminCertificateFilterSchema,
  reinstateCertificateSchema,
  revokeCertificateSchema,
} from "@/lib/validators/certificates";

export async function listAdminCertificatesAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "CERTIFICATE",
    operation: "ADMIN_LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin list certificates");
    await connectDB();

    const filters = adminCertificateFilterSchema.parse(rawFilters ?? {});
    const result = await listAdminCertificates(filters);
    return op.respond(result);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function revokeCertificateAction(raw: unknown) {
  const op = createServerOp({
    domain: "CERTIFICATE",
    operation: "ADMIN_REVOKE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = revokeCertificateSchema.parse(raw);
    await connectDB();

    const certificate = await revokeCertificate({
      certificateId: data.certificateId,
      adminId: session.user.id,
      reason: data.reason,
    });
    if (!certificate) throw new ActionError("Certificate not found.");

    op.allowed({
      action: "revoke_certificate",
      resource: `certificate:${maskId(data.certificateId)}`,
      role: session.user.role,
    });

    revalidatePath("/admin/certificates");
    return op.respond({ success: true, status: certificate.status });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function reinstateCertificateAction(raw: unknown) {
  const op = createServerOp({
    domain: "CERTIFICATE",
    operation: "ADMIN_REINSTATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = reinstateCertificateSchema.parse(raw);
    await connectDB();

    const certificate = await reinstateCertificate(data.certificateId);
    if (!certificate) throw new ActionError("Certificate not found.");

    op.allowed({
      action: "reinstate_certificate",
      resource: `certificate:${maskId(data.certificateId)}`,
      role: session.user.role,
    });

    revalidatePath("/admin/certificates");
    return op.respond({ success: true, status: certificate.status });
  } catch (error) {
    return op.respondError(error);
  }
}
