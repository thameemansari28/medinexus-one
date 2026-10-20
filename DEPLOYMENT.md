# Publish MediNexus One

The public website has two services:

- **Vercel** hosts the Vite frontend.
- **Render** hosts the Express API and its persistent local-account data.

## 1. Put this folder in a GitHub repository

Create a new GitHub repository and upload the contents of this folder. The
repository root must contain `package.json`, `backend/`, `render.yaml`, and
`vercel.json`.

## 2. Deploy the API on Render

1. Open Render and select **New > Blueprint**.
2. Select the GitHub repository and use the included `render.yaml`.
3. Set `FRONTEND_URL` temporarily to `https://medinexus-one.vercel.app`.
4. Deploy. Copy the resulting API URL, for example
   `https://medinexus-api.onrender.com`.

The blueprint provisions a persistent disk at `/var/data`, used for local
accounts, appointments, profile photos, and records. Keep the `starter` plan
and disk for persistent presentation data.

## 3. Deploy the website on Vercel

1. Open Vercel and select **Add New > Project**.
2. Import the same GitHub repository.
3. Vercel detects Vite. Keep build command `npm run build` and output folder
   `dist`.
4. Add the Vercel environment variable:

   `VITE_API_BASE_URL=https://YOUR-RENDER-API.onrender.com`

5. Deploy. Vercel gives you a public URL ending in `.vercel.app`.

## 4. Connect frontend and API

In Render, change `FRONTEND_URL` to the exact Vercel URL, then redeploy the
API. If you later add a custom domain, use both origins separated by a comma:

`https://medinexus-one.vercel.app,https://your-domain.com`

## 5. Add a .com domain

Buy a domain from a registrar or Vercel. In Vercel open **Project > Settings >
Domains**, add the domain, and copy the DNS records that Vercel provides into
your domain registrar. Add the final HTTPS domain to Render's `FRONTEND_URL`,
then redeploy the API.
