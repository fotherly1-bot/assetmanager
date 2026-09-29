# Asset Manager — Midlands Highways Plant

Web-based plant and asset control for a UK civil engineering / highways contractor.

**Live (GitHub Pages):** https://fotherly1-bot.github.io/assetmanager/

## Stack

- **Frontend:** Vite + React + TypeScript
- **Backend (local dev):** Express (Node.js) with a JSON file store (`data/db.json`)
- **GitHub Pages:** static client only — data lives in the browser (`localStorage`)
- **Auth:** demo login (JWT via Express locally, client-side session on Pages)
- **Theme:** Light / dark toggle (persisted in the browser)

## GitHub Pages

The site is built and deployed by GitHub Actions on every push to `main`.

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually)
3. App URL: https://fotherly1-bot.github.io/assetmanager/

On Pages there is no Express server. The client seeds demo data into `localStorage` on first load and keeps CRUD there. Clearing site data resets to the seed.

### Demo login

| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@contractor.local` |
| Password | `admin123`               |

## Quick start (local)

```bash
cd "/workspace/asset manager"
npm install
cd client && npm install && cd ..
npm run dev
```

This starts:

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| API      | http://localhost:3001 |

The Vite base path is `/assetmanager/` (same as Pages). The Vite proxy still maps `/api` to Express. In development the client prefers the Express API; if the API is unreachable it falls back to `localStorage`. Production builds always use `localStorage`.

### Demo login

| Field    | Value                    |
|----------|--------------------------|
| Email    | `admin@contractor.local` |
| Password | `admin123`               |

## Features

1. **Auth** — login, session, logout  
2. **Theme** — light/dark slider in the top bar (and on the login page)  
3. **Customers** — CRUD list and detail  
4. **Assets** — six categories (Vehicles, Machinery / plant, Hand tools, Power tools, Building products, Consumables)  
5. **Asset fields** — name, SKU, category, condition, fuel tank/level, GPS + description + UK postcode, job assignment, time on job, notes  
6. **Fuel UI** — green→amber→red bar, manual level entry, fuel cost log (£ / litres / odometer-hours)  
7. **Asset detail** — job, location, time on job, fuel, maintenance, bookings  
8. **Inventory** — stock listing by category with quantity and reorder alerts  
9. **Maintenance** — Service / MOT / PAT / LOLER with next-due highlighting for overdue items  
10. **Jobs** — linked to customers, required assets, dates, status  
11. **Job planner board** — kanban with colour-coded asset availability (available / on job / booked / maintenance)  
12. **Calendar** — weekly booking grid, conflict detection  
13. **Reports** — utilisation, fuel costs, maintenance due, assets by location/category; print-friendly  
14. **Navigation** — sidebar: Dashboard, Assets, Inventory, Customers, Jobs/Planner, Calendar, Maintenance, Reports, Settings  

## Seed data

- **Local Express:** on first run the API creates `data/db.json` (gitignored). Delete it and restart to re-seed.
- **Pages / localStorage:** the client seeds the same demo set on first visit. Clear site storage to re-seed.

Includes 4 UK highways-style customers, 15 assets across all categories, 5 jobs, fuel logs, maintenance records, and calendar bookings.

## Scripts

| Command           | Description                     |
|-------------------|---------------------------------|
| `npm run dev`     | API + Vite client (recommended) |
| `npm run server`  | API only on port 3001           |
| `npm run client`  | Vite only on port 5173          |
| `npm run build`   | Production client build (+ SPA `404.html`) |

## British English

UI copy uses British English (colour, organised, metre/litres, etc.).

## Notes

- Pages deployment is static only — browser-local data, not shared between devices or users.  
- Local Express + JSON file is fine for MVP / demo use.  
- Not intended for multi-user production without a real database and hardened auth.  
- Do not commit `.env` files or tokens; they are gitignored.  
