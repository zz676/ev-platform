# Digest Aggregate Cron P2022 (Missing Column)

## Summary
The digest aggregation cron failed in production with Prisma error `P2022` because the database schema did not include a column that exists in the Prisma model (`DigestContent.digestImageUrl`). Prisma implicitly selects all model fields on `findFirst` and `create`, which caused the query to reference a non-existent column.

## Impact
- `/api/cron/digest-aggregate` failed and could not generate digest content.
- The error surfaced as:
  - `Invalid prisma.digestContent.findFirst() invocation`
  - `The column (not available) does not exist in the current database.`

## Root Cause
Schema drift between the Prisma model and the production database:
- Prisma model includes `digestImageUrl` on `DigestContent`.
- Production DB was missing the `digestImageUrl` column.
- Prisma `findFirst` was invoked without an explicit `select`, so it attempted to read all model columns.

## Fix
1. **DB schema updated** to include the missing column:
   ```sql
   ALTER TABLE "DigestContent"
     ADD COLUMN IF NOT EXISTS "digestImageUrl" TEXT;
   ```
2. **Code hardened** to avoid implicit column selection and to tolerate missing optional columns:
   - Add explicit `select` in `digestContent.findFirst/create/update` for cron routes.
   - Wrap the `digestImageUrl` update with `P2022` handling (log and continue).

## Files Updated
- `src/app/api/cron/digest-aggregate/route.ts`
- `src/app/api/cron/digest/route.ts`

## Verification
- `npm run build`
- Manually call:
  - `GET /api/cron/digest-aggregate` (with `Authorization: Bearer $CRON_SECRET`)
  - `GET /api/cron/digest` (with `Authorization: Bearer $CRON_SECRET`)

## Prevention
- Keep DB migrations in sync with Prisma schema.
- Use explicit `select` for Prisma queries when optional columns may be missing in some environments.
