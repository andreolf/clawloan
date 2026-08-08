-- ============================================================================
-- Supabase RLS remediation for Clawloan/Moltloan
-- Fixes the "rls_disabled_in_public" / "Table publicly accessible" advisor error.
--
-- WHY THIS IS SAFE FOR PRISMA:
--   Prisma connects with DATABASE_URL as the table-owner role (`postgres`),
--   which has BYPASSRLS. Enabling RLS therefore does NOT affect the app's own
--   queries. It ONLY closes the public PostgREST/anon + authenticated API that
--   Supabase auto-exposes over the internet — which is exactly what the advisor
--   is warning about (anyone with the project URL + anon key could read/write).
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Re-run any time after `prisma db push` recreates a table.
-- ============================================================================

-- Enable RLS on every Prisma-managed table (PascalCase, quoted).
ALTER TABLE public."Bot"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Loan"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deposit"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Usage"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PoolStats"  ENABLE ROW LEVEL SECURITY;

-- Also FORCE RLS so that even a table-owner going through PostgREST is subject
-- to policies (defense in depth). The direct Prisma connection still bypasses
-- via BYPASSRLS, so the app is unaffected.
ALTER TABLE public."Bot"        FORCE ROW LEVEL SECURITY;
ALTER TABLE public."Loan"       FORCE ROW LEVEL SECURITY;
ALTER TABLE public."Deposit"    FORCE ROW LEVEL SECURITY;
ALTER TABLE public."Permission" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."Usage"      FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PoolStats"  FORCE ROW LEVEL SECURITY;

-- Explicitly revoke the auto-granted API roles so the public REST/GraphQL API
-- cannot touch these tables at all. (RLS with zero policies already denies all,
-- but revoking GRANTs is belt-and-suspenders and silences the advisor cleanly.)
REVOKE ALL ON public."Bot"        FROM anon, authenticated;
REVOKE ALL ON public."Loan"       FROM anon, authenticated;
REVOKE ALL ON public."Deposit"    FROM anon, authenticated;
REVOKE ALL ON public."Permission" FROM anon, authenticated;
REVOKE ALL ON public."Usage"      FROM anon, authenticated;
REVOKE ALL ON public."PoolStats"  FROM anon, authenticated;

-- NOTE: We intentionally create NO policies. All access to this data must go
-- through the Next.js API routes (server-side, via Prisma). If you ever want
-- read-only public access to, e.g., PoolStats, add a narrow SELECT policy:
--
--   CREATE POLICY "public read pool stats" ON public."PoolStats"
--     FOR SELECT TO anon USING (true);
-- ============================================================================
