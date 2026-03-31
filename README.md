# Daily Checklist App

Hourly checklist, fault reporting, and historical records for washline operations.

## Stack

- Static HTML, CSS, and browser JavaScript
- Netlify Functions for the `/api/*` endpoints
- Supabase Postgres for shared persistent storage

## Environment Variables

Set these in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Netlify Deployment

1. Push this project to GitHub.
2. In Netlify, choose `Add new site` and import the GitHub repo.
3. Netlify will detect [netlify.toml](c:/ChemPack/Daily%20Checklist/netlify.toml).
4. In Supabase, open the SQL editor and run [schema.sql](c:/ChemPack/Daily%20Checklist/supabase/schema.sql).
5. In Netlify, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
6. Deploy the site.

The redirect in [netlify.toml](c:/ChemPack/Daily%20Checklist/netlify.toml) sends `/api/*` requests to [api.js](c:/ChemPack/Daily%20Checklist/netlify/functions/api.js), which stores checklist data in Supabase through [db.js](c:/ChemPack/Daily%20Checklist/netlify/functions/db.js).

## Notes

- The Supabase tables must exist before the site can read or write data.
- If the `data/*.json` files exist during deployment, the function will try to migrate that legacy data once.
- The old Render and SQLite files can be removed after you are happy with the Netlify deployment.
