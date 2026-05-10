# CLAUDE.md — searchAgent

## What this project is

A generic RAG chat frontend built on React + Vite, deployed as a Cloudflare Worker. It wraps the `@cloudflare/ai-search-snippet` Web Component and connects it to a Cloudflare AI Search index. The Worker itself only handles JWT auth (Cloudflare Access) and static asset serving — all RAG logic lives in the AI Search service.

This codebase is intentionally dataset-agnostic. It can be deployed multiple times from one repo, each pointing at a different AI Search index (dataset).

## Architecture

```
Browser → Cloudflare Access (JWT) → Worker (src/worker.js)
                                         └─ serves Vite SPA (public/)
                                              └─ <chat-page-snippet> Web Component
                                                   └─ VITE_API_URL (AI Search index)
```

- **`src/worker.js`** — validates Cloudflare Access JWT, serves static assets, SPA fallback
- **`src/App.jsx`** — settings state + passes `VITE_API_URL` to ChatPageWrapper
- **`src/ChatPageWrapper.jsx`** — renders `<chat-page-snippet>` with RAG config props
- **`src/Settings.jsx`** — side panel for match threshold, max results, context expansion, etc.
- **`wrangler.toml`** — one `[env.*]` block per deployment
- **`.env`** — `VITE_API_URL` for local dev (not secret, but gitignored patterns leave this committed)

## What changes per dataset deployment

| Config | Location |
|---|---|
| AI Search endpoint URL | `API_URL` runtime var in `[env.<name>]` in `wrangler.toml` |
| Worker name / subdomain | `name` in `[env.<name>]` in `wrangler.toml` |
| Cloudflare Access AUD | `CLOUDFLARE_ACCESS_AUD` in `[env.<name>]` in `wrangler.toml` |
| System prompt | Cloudflare AI Search dashboard — **not in this repo** |

`API_URL` is a **runtime** Worker var. The Worker injects it into the HTML as `window.API_URL` on each request, so a single build artifact works for all dataset deployments. Local dev falls back to `VITE_API_URL` in `.env`.

# Model Names
- Use exact model names as specified by the user (e.g., 'gpt-5-mini' is NOT 'gpt-4o-mini')
- Do not substitute or 'correct' model identifiers based on assumptions about what exists

## Don't Go In Circles
- If two attempts at the same fix fail, STOP and reconsider the approach rather than tweaking variations
- Verify component/API names exist before referencing them (e.g., don't guess 'snippet-search')

## Datasets

| Env name | Worker name | Notes |
|---|---|---|
| `hadis` | `search-agent-hadis` | first dataset, AUD already set |
| `keller` | `search-agent-keller` | second dataset, AUD placeholder — fill in after creating CF Access app |

## Common commands

```bash
npm run dev                       # local dev (uses VITE_API_URL from .env as fallback)
npm run build                     # build once — same bundle for all deployments
npm run worker:dev                # wrangler dev (local) against hadis env — port 8787
npm run worker:dev:keller         # wrangler dev (local) against keller env — port 8787
npm run worker:deploy             # build once, deploy to both hadis + keller
npm run worker:deploy:hadis       # deploy hadis only (no build)
npm run worker:deploy:keller      # deploy keller only (no build)
```

## Adding a new dataset deployment — full checklist

### On Cloudflare (dashboard)
1. Create or identify the AI Search index → copy the endpoint UUID
2. Configure the **system prompt** for that index in the AI Search dashboard
3. Create a new **Cloudflare Access application** scoped to the new Worker subdomain  
   (e.g. `search-agent-newname.maratkurbanov.workers.dev`) → copy the AUD value

### Locally
1. Add a new environment block to `wrangler.toml` (copy the `[env.keller]` block as a template)
2. Fill in the new Worker `name` and `CLOUDFLARE_ACCESS_AUD`
3. Add a deploy script to `package.json`: `"worker:deploy:newname": "vite build && wrangler deploy --env newname"`
4. Build and deploy:
   ```bash
   VITE_API_URL=https://<new-uuid>.search.ai.cloudflare.com/ npm run build
   wrangler deploy --env newname
   ```

## Key constraints

- `VITE_API_URL` is a **build-time** variable (baked into the JS bundle by Vite). It is NOT a runtime Worker env var — changing it in `wrangler.toml` vars has no effect; you must pass it during `npm run build`.
- The `[ai]` binding in `wrangler.toml` is defined but unused by the Worker — the AI inference happens inside the managed AI Search service, not here.
- Cloudflare Access JWT validation is bypassed for `localhost` — no Access setup needed for local dev.

## Mobile UI Changes

**Any request that touches mobile layout, responsive CSS, tap targets, or viewport behavior must be routed through the `mobile-verifier` subagent** (`.claude/agents/mobile-verifier.md`). The agent implements the change, screenshots at 375/768/1280px via Playwright MCP, verifies no cut-off elements, no overlaps, and all tap targets ≥44px, and iterates up to 5 times before reporting.

Trigger phrase examples: "fix mobile", "responsive", "tap target", "viewport", "screen size", "phone layout", "iPad", "small screen".

## Logging section near the top of CLAUDE.md, before any framework-specific instructions\n\n## Logging
- Never comment out or remove console.log/debug statements when fixing bugs - they are essential for diagnosis
- When adding logging, cover BOTH server and client paths (including UI components like SearchResults.jsx)


## Cloudflare Workers section in CLAUDE.md\n\n## Cloudflare Workers
- Use the modern [assets] binding pattern in wrangler.toml - NOT the deprecated Workers Sites / getAssetFromKV approach
- For MCP server scope, use `--scope user` (not `--scope global` which is invalid)
- When debugging, check whether running locally vs production and apply migrations to the local D1 database
