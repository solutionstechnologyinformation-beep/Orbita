import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { companyDomains, companies } from "../drizzle/schema";

export type ResolvedTenant = {
  companyId: number;
  domain: string;
  isPrimary: boolean;
  primaryDomain: string | null;
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
      isPrimary: companyDomains.isPrimary,
      name: companies.name,
      color: companies.color,
      logoUrl: companies.logoUrl,
      logoDarkUrl: companies.logoDarkUrl,
    })
    .from(companyDomains)
    .innerJoin(companies, eq(companyDomains.companyId, companies.id))
    .where(and(eq(companyDomains.domain, host), eq(companyDomains.status, "verified")))
    .limit(1);

  if (!record) return null;

  let primaryDomain: string | null = record.isPrimary ? record.domain : null;
  if (!record.isPrimary) {
    const [primaryRecord] = await db
      .select({ domain: companyDomains.domain })
      .from(companyDomains)
      .where(and(eq(companyDomains.companyId, record.companyId), eq(companyDomains.isPrimary, true), eq(companyDomains.status, "verified")))
      .limit(1);
    primaryDomain = primaryRecord?.domain ?? null;
  }

  return {
    companyId: record.companyId,
    domain: record.domain,
    isPrimary: record.isPrimary,
    primaryDomain,
    name: record.name,
    color: record.color,
    logoUrl: record.logoUrl,
    logoDarkUrl: record.logoDarkUrl,
  };
}
