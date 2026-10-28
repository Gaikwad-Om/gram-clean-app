# Gram Clean

A mobile-first village maintenance app for residents, field workers, supervisors and village administrators. The project includes a local demo, an optional live Supabase integration, a private photo workflow, a server-side Gemini reporting assistant, and Capacitor Android configuration.

## Run the demo

Use Node.js 22 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use **Preview as** to explore the resident, worker, supervisor and admin flows. Demo changes stay in this browser's local storage; they are not sent to a server. **Reset demo data** restores the sample village.

## Connect a Supabase project

1. Create a Supabase project and copy its URL and publishable key into a local `.env` file based on `.env.example`.
2. Install the Supabase CLI, sign in, link the project, then apply the migration:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Configure Auth email confirmation and redirect URLs for local, preview and production hosts.
4. Register the first administrator through Auth. Use the bootstrap SQL in [supabase/README.md](supabase/README.md) to create the village and grant that account its first admin membership. Add wards and departments in the admin screen before residents file reports.
5. Run `npm run dev` again. When both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set, the app uses Supabase Auth and village data instead of the local demo.

The migration and Edge Function are source files only until you apply and deploy them to your own Supabase project. Review and exercise the database permissions with separate roles and at least two villages before entering real resident data. Never put a service-role key in this frontend or commit credentials.

### Optional AI reporting help

The app's **Help me write this** action calls `supabase/functions/report-assistant` only after the resident requests a suggestion. Configure a server-side `GEMINI_API_KEY`, then deploy the function:

```sh
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
supabase functions deploy report-assistant
```

Set `GRAM_CLEAN_ALLOWED_ORIGIN` as a Supabase Function secret to your exact deployed origin. Without the function and key, residents can still submit reports manually. The app also offers an optional similar-report check against recent reports in the current village; it returns only a short category, status, ward and date summary.

## Android

Install Android Studio and its Android SDK, then run:

```sh
npm run android:add
npm run android:sync
npm run android:open
```

The report form uses Capacitor Geolocation on Android and browser geolocation on web only after a resident presses **Use GPS**. Photo selection requests a camera capture on supported mobile browsers. Confirm location and camera behavior, permission denial, offline errors, sign-in and screen sizes on a real Android phone before a pilot. Android release signing is not configured here.

## Web deployment

For Vercel, import the project, use `npm run build` as the build command and `dist` as the output directory. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to each Vercel environment. `vercel.json` provides the single-page app route fallback. Add the deployment origin to Supabase Auth redirect URLs and to `GRAM_CLEAN_ALLOWED_ORIGIN` if AI reporting is enabled.

Keep development and production Supabase projects separate where practical. Apply reviewed migrations to production separately and invite residents only after the pilot checks are complete.

## Project layout

- `src/` — responsive React + TypeScript app, local demo and Supabase repository calls
- `supabase/migrations/` — organization-scoped schema, RPC workflows, RLS and private photo storage
- `supabase/functions/report-assistant/` — optional authenticated server-side Gemini helper
- `capacitor.config.ts` — Android app identity and Vite `dist` output
- `.env.example` — browser-safe Supabase settings only

## Current limits

This repository is an implementation in progress, not a production release. The migration has not been applied to a live project, the Gemini function has not been deployed, and no Android package or Vercel deployment has been published. Automated role, cross-village, Storage, mobile-permission, backup and restore checks still need to be run against configured environments. GPS is optional and saves coordinates only after the resident requests them. AI provides non-binding wording/category suggestions; it does not assign, verify, close issues or award credits.
