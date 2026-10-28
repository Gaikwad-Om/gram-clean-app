# Supabase setup

The initial migration creates the organization-scoped tables, membership checks, issue workflow RPCs, private photo bucket and row-level policies. It does not create a real village or administrator account. With both frontend environment values set and the migration applied, the browser UI connects to Supabase; without them, it stays in local demo mode.

## First village bootstrap

1. Create the project, set Auth providers and redirect URLs, and apply the migration.
2. Register the first administrator account through Supabase Auth.
3. In the SQL editor, create the village and grant that account its first admin membership. Replace both sample values:

```sql
with new_village as (
  insert into public.organizations (name, slug)
  values ('Your Village', 'your-village')
  returning id
)
insert into public.memberships (organization_id, user_id, role)
select new_village.id, auth_user.id, 'admin'
from new_village
join auth.users auth_user on auth_user.email = 'admin@example.org';
```

4. Add wards and departments for that organization. Administrators can promote another existing member with `admin_set_member_role`; public self-registration can only join a village as a resident through `join_village`.

## Security model in this migration

- Issues are visible to their reporter, their assigned workers, and that village's supervisors and admins. Residents do not see other residents' private report details.
- Authenticated users have no direct write access to issue workflow, assignments, status history, verifications, the points ledger or audit logs. The granted RPCs check the caller's active village role and issue state.
- Photo objects stay in the private `issue-photos` bucket. Upload paths use `organization UUID / issue UUID / uploader UUID / filename`, and policies check the issue relationship and active membership.
- Residents use an idempotency key for retries. Point awards use one unique key per verified issue and contribution, so retries or later re-verification cannot add the same award twice.
- The profile creation trigger creates a profile only; it never grants village membership or a role.

## Before real resident data

This is an initial security foundation, not a certified production release. Configure a development project and execute migration checks and allowed/denied requests with separate resident, worker, supervisor and admin accounts in at least two villages. Also check photo access, Storage upload limits, role changes, review retries, backups and restore. Keep the service-role key server-side. Add rate limiting, duplicate/spam review, retention rules and monitored server-side notifications as the pilot requirements become concrete.

## Apply and configure

From the project root, authenticate the Supabase CLI and link the intended development project before pushing migrations:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the local `.env` file. The app uses Supabase Auth, village-scoped database reads and RPC workflows, private photo uploads, notifications, points and the duplicate-report summary function when live mode is configured.

The optional `report-assistant` Edge Function expects a server-side `GEMINI_API_KEY`. Set the Supabase secret and deploy it with `supabase secrets set GEMINI_API_KEY=...` and `supabase functions deploy report-assistant`. Set `GRAM_CLEAN_ALLOWED_ORIGIN` to the deployed app origin. The API key must not be placed in a `VITE_` variable.

The browser also supports manual location entry and optional GPS capture. Precise coordinates are persisted only when the resident requests GPS. Report and completion photo uploads are limited to JPG, PNG or WebP files up to 10 MB.

Applying this migration, deploying the Edge Function, running role and cross-village checks, testing photo permissions and exercising backup/restore are separate steps against a configured Supabase project. The source files have not been applied or executed against a live project in this workspace. Do not treat the migration as production-certified until those checks pass.
