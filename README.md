# Scrubs

Landrum ENT employee uniforms, branded with the official Landrum ENT logo and its navy (#082A61), blue (#00A7EB), and slate (#7992B1) palette. The shop has a collection-grouped approved catalog, live supplier photos, browser cart, server-validated allowances, and a protected administrator workspace.

## Employee allowance

Each submission requires **3 black sets and 2 navy sets**. A set is one top and one pair of pants **from the same collection**; styles and sizes may be mixed within that collection. Employees may choose sets from multiple collections, but each collection must have matching top/pant counts within each color. A packaged complete set counts toward both pieces and uses a single size. Underscrubs CK4881CL and CK773 are eligible as tops and may pair with pants from any approved collection. White CK773 tops must be explicitly assigned to a black or navy set and cannot be counted twice.

Employees may optionally add **1 black and 1 navy long-sleeve top**, plus **1 black and 1 navy jacket**, in addition to the five sets. Long-sleeve styles CK962A, CK4881CL, and CK773 can be selected either as a required top or as an additional long sleeve. White is allowed only for required tops, not additional long sleeves. The five sets are required; extras are optional. These limits apply to each submitted order. Employee authentication and cumulative per-employee allotment tracking across multiple submissions are not implemented.

The initial catalog includes the 15 unique approved styles supplied by the organization: CK00038, CK115, CK105, CK096, CK936, CK272, CK953, CK954, CK00034, CK962A, the AllHeart unisex set, CK4881CL, CK773, CK4350, and CK00013. The duplicated set link appears only once. Product links omit the original query strings that selected unapproved colors. Default sizes are XS–2XL; supplier color, size, and stock availability have not been independently verified. No prices, payment, or email delivery are implemented.

## Run locally

Requires Node.js 22 or newer; no third-party runtime dependencies.

```sh
npm start
npm test
```

The server uses port 3000 (`PORT` overrides it). `/admin` is the administrator workspace. Set `SCRUBS_ADMIN_TOKEN` to a strong secret through secure environment configuration; enter it on the administrator sign-in form. Without a configured token, administrator APIs are unavailable. Never commit tokens. Deploy behind HTTPS.

## Add or update approved styles

In `/admin`, sign in and choose **Add approved style**. Enter the SKU, name, collection, HTTPS supplier link, category, sizes, and approved colors. Enter live HTTPS supplier photo links in the default and/or color-specific photo fields (right-click a supplier product photo and choose Copy image address). Use the same collection name for matching tops and pants; only actual approved underscrubs should be marked as able to pair with any collection. For long-sleeve tops, select whether they qualify for the five required tops, the extra long-sleeve allowance, or both. Complete sets contribute both a top and pants; jackets use the extra jacket allowance. Only tops may have white as an approved color.

Choose **Edit** to update an existing style or clear **Active** to retire it. Retired items disappear from the employee shop and cannot be submitted. Submitted orders retain the names, SKUs, sizes, colors, product links, and allowance assignments recorded at submission. Existing carts are validated against the latest catalog on submission; employees should reload to see newly approved styles.

## Data and validation

Orders are saved to `data/orders.jsonl`; catalog changes are saved atomically to `data/catalog.json`. Both use restricted file permissions. `SCRUBS_DATA_DIR` overrides the directory. Back up the entire data directory and use durable storage for deployment. This is a single-instance implementation; use a database and employee authentication before deploying a multi-instance service or enforcing a cumulative employee allotment. Catalog changes require administrator authentication. UI escapes catalog and employee text, and the server validates sizes, colors, approved allowance types, white assignments, collection matching, and quantity limits.

`catalog.js` defines the initial styles, and `product-images.js` records actual live photo URLs extracted from the supplied supplier pages. CK962A and the packaged unisex set are Workwear Originals Ultra, as confirmed by their supplier descriptions. The logo in `public/assets/landrum-logo.svg` comes from Landrum ENT's official website. Live photos are loaded directly from supplier websites, change with color when available, and may stop working if the supplier changes its URLs. The CK4881CL page currently supplies only a black photo; navy selection uses the black style photo with an explicit color disclaimer. Existing saved catalogs get missing image/mix-and-match fields filled from the initial catalog, while existing administrator overrides and historical orders remain intact.

`catalog.js` defines the initial styles; administrator updates persist separately. `public/policy.js` contains allowance counting shared by the browser and server. Tests exercise the order API, access protection, allowance rules, catalog edits and retirement, persistence across restarts, and historical order details.

Email notifications still require the administrator destination and email delivery provider. Orders currently arrive only in the administrator inbox.

## Free deployment: Render + Supabase

`render.yaml` uses Render's **Free** web service with no paid disk. Orders and catalog changes are stored in a separate **Free** Supabase project. Stay within both providers' free quotas; no paid plan is required by this configuration. Render free services sleep when idle, so initial page loads can be slow. Supabase free projects may pause after inactivity and need resuming. Check the providers' current free-plan terms before using this for ongoing employee orders.

### 1. Create free storage

1. Sign up at https://supabase.com using GitHub.
2. Create a project in a **Free** organization. Set a database password securely; this application does not need that password.
3. In the project's **SQL Editor**, paste the contents of `supabase.sql` from this repository and run it. This creates two private tables with row-level security and no public access.
4. Copy the project's HTTPS URL (or the full API URL from **Data API**, including `/rest/v1/`) and its server-only secret key (or legacy `service_role` key) from project settings / API keys. Either URL format is accepted. Do not use the public publishable or `anon` key. Never send the secret key in chat or commit it.

### 2. Host the site for free

1. Sign up at https://render.com using GitHub and grant access to `landrum730/Scrubs`.
2. Choose **New → Blueprint**, select the repository and `main` branch.
3. When prompted, enter `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into Render's secure environment settings.
4. Verify the service plan is **Free** with no disk or other paid resource, then deploy. Render runs `npm test` before starting the server.
5. Once deployment is successful, open the HTTPS website address Render provides. Administrator access is that address followed by `/admin`.
6. In the service's environment settings, securely reveal the generated `SCRUBS_ADMIN_TOKEN` and enter it on the administrator sign-in form. Do not send this token in chat.

The cloud deployment requires Supabase: missing credentials, missing tables, or database failures stop storage operations. It never falls back to Render's temporary filesystem or acknowledges an unsaved order. For local development, the default storage remains the ignored `data/` directory. Set `SCRUBS_STORAGE=supabase` plus the two Supabase variables to use remote storage locally. Deploy a single instance to serialize catalog updates. Back up the database periodically. Existing local orders or catalog edits are not migrated automatically.

The free infrastructure deployment has not been validated against a real Supabase project yet; the repository tests verify the storage protocol, configuration errors, and failed writes with controlled responses. After configuring your project, confirm that an employee order appears in `/admin` and survives a Render restart. Email notifications require the administrator address and delivery provider; existing employee access/allotment limitations remain as described above.
