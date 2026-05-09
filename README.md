# Cloudflare AI Search — Chat & Search Frontend

A React + Vite SPA deployed as a Cloudflare Worker. Wraps `@cloudflare/ai-search-snippet`'s `<chat-page-snippet>` Web Component for the chat tab, and uses a custom React search component for the search tab. JWT auth is handled by Cloudflare Access via the Worker; all RAG logic lives in the AI Search service.

## Features

- **Chat tab** — Full-page conversation interface with sidebar history (`<chat-page-snippet>`)
- **Search tab** — Custom result cards with a full-text overlay on click (no broken `.txt` links)
- **Dark/Light Mode** — Automatic theme detection via CSS `prefers-color-scheme`
- **Settings panel** — Live adjustment of match threshold, max results, context expansion, query rewriting, re-ranking

## Settings Panel

| Setting | Default | Description |
|---|---|---|
| Match Threshold | 0.3 | How strictly results must match the query (0–1) |
| Maximum Results | 10 | Number of chunks to return |
| Context Expansion | 0 | Extra context sentences around each chunk |
| Rewrite Query | true | LLM rewrites query before search |
| Re-rank Results | false | Re-rank by relevance after retrieval |

## Project Structure

```
src/
├── App.jsx               # Root — tabs, settings state, API_URL resolution
├── App.css               # Layout, CSS variables (light/dark)
├── index.css             # Base reset
├── main.jsx              # React entry point
├── ChatPageWrapper.jsx   # Renders <chat-page-snippet> web component
├── SearchBarWrapper.jsx  # Thin wrapper → SearchResults
├── SearchResults.jsx     # Custom search: input, result cards, full-text overlay
├── SearchResults.css     # Search component styles
├── Settings.jsx          # Settings side panel
└── worker.js             # Cloudflare Worker: JWT validation + static asset serving

patches/
└── @cloudflare+ai-search-snippet+0.0.30.patch   # Removes metadata_only:true; adds text-based result mapping

wrangler.toml             # One [env.*] block per deployment
vite.config.js
package.json
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

This also applies the `patches/` via the `postinstall` hook.

### 2. Set the API URL

Create a `.env` file in the project root (if it doesn't exist):

```
VITE_API_URL=https://<your-uuid>.search.ai.cloudflare.com/
```

Replace `<your-uuid>` with the UUID of your AI Search index.

### 3. Start the dev server

**Option A — Vite only** (fastest, no Worker involved, Cloudflare Access JWT is bypassed on localhost):

```bash
npm run dev
```

Opens at **http://localhost:5173**. Uses `VITE_API_URL` from `.env`.

**Option B — Full Worker stack** (Vite in watch mode + Wrangler serving the Worker locally):

```bash
npm run worker:dev          # hadis dataset → http://localhost:8787
npm run worker:dev:keller   # keller dataset → http://localhost:8787
```

This runs `vite build --watch` and `wrangler dev` in parallel. Use this when you need to test Worker-specific behaviour (JWT handling, `window.API_URL` injection, etc.).

## API Configuration

`VITE_API_URL` is a **build-time** variable baked into the JS bundle by Vite. It is **not** a runtime Worker var.

For local dev, set it in `.env`:

```
VITE_API_URL=https://<your-uuid>.search.ai.cloudflare.com/
```

The Worker injects `window.API_URL` at runtime from the `[env.*]` vars in `wrangler.toml`, so a single build artifact works for all dataset deployments. The app reads: `window.API_URL || import.meta.env.VITE_API_URL`.

## Deployments

This repo deploys as two independent Workers, one per dataset:

| Env name | Worker name | Dataset |
|---|---|---|
| `hadis` | `search-agent-hadis` | first dataset |
| `keller` | `search-agent-keller` | second dataset |

### Deploy commands

```bash
npm run worker:deploy           # build once, deploy to both hadis + keller
npm run worker:deploy:hadis     # deploy hadis only (no build)
npm run worker:deploy:keller    # deploy keller only (no build)
```

Manual deploy for a specific env:

```bash
VITE_API_URL=https://<uuid>.search.ai.cloudflare.com/ npm run build
wrangler deploy --env hadis
```

## Adding a New Dataset Deployment

### On Cloudflare (dashboard)
1. Create or identify the AI Search index → copy the endpoint UUID
2. Configure the system prompt for that index in the AI Search dashboard
3. Create a Cloudflare Access application scoped to the new Worker's subdomain (e.g. `search-agent-newname.maratkurbanov.workers.dev`) → copy the AUD value

### Locally
1. Add a new `[env.newname]` block to `wrangler.toml` (copy the `[env.keller]` block):
   ```toml
   [env.newname]
   name = "search-agent-newname"
   vars = { CLOUDFLARE_ACCESS_AUD = "<new-aud>", CLOUDFLARE_ACCESS_JWKS_URL = "https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs", ENVIRONMENT = "production", LOG_LEVEL = "warn" }
   ```
2. Add a deploy script to `package.json`:
   ```json
   "worker:deploy:newname": "wrangler deploy --env newname"
   ```
3. Build and deploy:
   ```bash
   VITE_API_URL=https://<new-uuid>.search.ai.cloudflare.com/ npm run build
   wrangler deploy --env newname
   ```

## Search Result Score Badge

Each search result card shows a one-line score badge in the top-right corner, e.g.:

```
0.999 · v:0.550 · k:59.8 · rrf
```

| Field | Meaning |
|---|---|
| `0.999` | Final ranking score for this chunk (after reranking if enabled; otherwise the fusion score). Higher = better match. Range 0–1. |
| `v:0.550` | Vector (semantic) similarity score — cosine similarity between the query embedding and the chunk embedding. Range 0–1. |
| `k:59.8` | Keyword (BM25) score — traditional full-text relevance score. Scale is unbounded; higher = more keyword overlap. |
| `rrf` | Fusion method used to combine vector and keyword scores. `rrf` = Reciprocal Rank Fusion (default); `max` = take the higher of the two scores. |

The badge is only shown when the AI Search response includes `scoring_details` on the chunk (returned for hybrid search). It is hidden when scoring details are absent.

## npm Package Patches

`@cloudflare/ai-search-snippet` is patched via `patch-package` (applied automatically on `npm install`):

- **Removes `metadata_only: true`** from search requests so full text is returned
- **Custom result mapping** — extracts `TITLE`, `URL` from the embedded text header; uses body text after the `====` separator as the description; falls back to a human-readable filename for chunks without a header

The patch file lives in `patches/`. If the package is upgraded to a version where the patch no longer applies, `npm install` will error loudly — review and regenerate the patch at that point.

## Deployment Checklist

**New dataset:**
- [ ] Create AI Search index, copy endpoint UUID
- [ ] Configure system prompt in AI Search dashboard
- [ ] Create Cloudflare Access application, copy AUD
- [ ] Add `[env.<name>]` block to `wrangler.toml`
- [ ] Add deploy script to `package.json`
- [ ] `VITE_API_URL=https://<uuid>.search.ai.cloudflare.com/ npm run build`
- [ ] `wrangler deploy --env <name>`
- [ ] Test the deployed Worker

**Updating an existing deployment:**
- [ ] `npm run build`
- [ ] `wrangler deploy --env hadis` and/or `wrangler deploy --env keller`

## Technologies

- **React 19** + **Vite 5**
- **Cloudflare Workers** + **Wrangler**
- **@cloudflare/ai-search-snippet** — `<chat-page-snippet>` Web Component (chat tab)
- **patch-package** — patches the snippet bundle to enable full-text retrieval
