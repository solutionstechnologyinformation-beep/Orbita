import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { companyDomains, companies } from "../drizzle/schema";

export type ResolvedTenant = {
  companyId: number;
  domain: string;
  name: string;
  color: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
};

export function normalizeHost(hostHeader: string | undefined): string {
  return (hostHeader ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export async function resolveTenantByHost(hostHeader: string | undefined): Promise<ResolvedTenant | null> {
  const host = normalizeHost(hostHeader);
  if (!host || host === "localhost" || host.startsWith("127.") || host.endsWith(".manus.computer")) {
    return null;
  }

  const db = await getDb();
  const [record] = await db
    .select({
      companyId: companyDomains.companyId,
      domain: companyDomains.domain,
      name: companies.name,
      color: companies.color,
      logoUrl: companies.logoUrl,
      logoDarkUrl: companies.logoDarkUrl,
    })
    .from(companyDomains)
    .innerJoin(companies, eq(companyDomains.companyId, companies.id))
    .where(and(eq(companyDomains.domain, host), eq(companyDomains.status, "verified")))
    .limit(1);

  return record ?? null;
}
