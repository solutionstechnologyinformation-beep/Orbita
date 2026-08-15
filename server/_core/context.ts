import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { resolveTenantByHost, type ResolvedTenant } from "../tenant-resolver";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenant: ResolvedTenant | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Express calcula req.hostname respeitando a configuração de proxy confiável.
  // Não usamos x-forwarded-host diretamente, pois o cliente poderia falsificá-lo.
  const tenant = await resolveTenantByHost(opts.req.hostname || opts.req.headers.host);

  if (tenant && user && user.role !== "master_admin" && user.companyId !== tenant.companyId) {
    // Keep the request authenticated but remove the cross-tenant context. Data authorization
    // continues to use the authenticated user's companyId, while branding cannot be spoofed.
    return { req: opts.req, res: opts.res, user, tenant: null };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenant,
  };
}
