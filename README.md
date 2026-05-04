# Cloudflare AI Search - Chat Page

A clean, minimal React + Vite application featuring the Cloudflare AI Search chat interface using the `@cloudflare/ai-search-snippet` library. Ready for deployment on Cloudflare Workers.

## Features

- **Full-page Chat Interface** - Complete conversation experience with history
- **Dark/Light Mode** - Automatic theme detection
- **Clean UI** - Focused, distraction-free chat experience
- **JavaScript/JSX** - No TypeScript, simple and straightforward
- **Cloudflare Workers Ready** - Deploy to Cloudflare Workers with one command

## Settings Panel

The side panel allows real-time adjustment of:

**Numeric Settings:**
- **Match Threshold** (0.0-1.0, default 0.3) - Controls query match strictness
- **Maximum Results** (1-50, default 10) - Number of search results to return
- **Context Expansion** (0-5, default 0) - Amount of context in responses

**Boolean Settings:**
- **Rewrite Query** (default true) - Automatically rewrite queries for better results
- **Re-rank Results** (default false) - Re-rank results based on relevance

All settings are toggleable and passed to the AI search in real-time.

## Project Setup

### Installation

```bash
npm install
```

### Local Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build

Build for production:

```bash
npm run build
```

### Preview

Preview the production build:

```bash
npm run preview
```

## Cloudflare Workers Deployment

This project is configured to deploy on Cloudflare Workers.

### Prerequisites

1. Install Wrangler CLI (already in devDependencies):
   ```bash
   npm install -D wrangler
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

3. Update `wrangler.toml`:
   - Replace `example.com` with your domain
   - Configure environment-specific settings as needed

### Deploy Commands

**Development (local testing):**
```bash
npm run worker:dev
```

**Dry run (preview changes):**
```bash
npm run worker:build
```

**Production deployment:**
```bash
npm run worker:deploy
```

### Wrangler Configuration

The `wrangler.toml` file contains:
- Worker entry point: `src/worker.js`
- Build command: `npm run build`
- Output directory: `public/` (Vite build output)
- Asset caching rules for optimal performance

### How It Works

1. **Vite Build** - Builds React app to `public/` directory
2. **Worker** - Serves static files from `src/worker.js`
3. **Asset Handler** - Uses Cloudflare's KV asset handler for caching
4. **Routing** - All requests route to `index.html` (SPA routing)

## API Configuration

The AI Search endpoint is set via the `VITE_API_URL` environment variable, injected at build time by Vite.

For local development, set it in `.env`:

```
VITE_API_URL=https://<your-uuid>.search.ai.cloudflare.com/
```

For deployments, pass it as a build-time variable (see Multi-Dataset Deployment below).

## Multi-Dataset Deployment

This repo is designed to be deployed multiple times — once per dataset/vector index — from a single codebase. Each deployment is an independent Cloudflare Worker with its own URL and access policy.

### What changes per deployment

| Thing | Where to change |
|---|---|
| AI Search endpoint UUID | `VITE_API_URL` env var at build time |
| Worker name / subdomain | `name` field in `[env.<name>]` in `wrangler.toml` |
| Cloudflare Access audience (AUD) | `CLOUDFLARE_ACCESS_AUD` var in `[env.<name>]` in `wrangler.toml` |
| System prompt | Cloudflare AI Search dashboard (per index, not in this repo) |

### Steps to add a new dataset deployment

**On Cloudflare (dashboard):**
1. Create (or identify) the AI Search index for the new dataset — copy its endpoint UUID
2. Configure the system prompt for that index in the AI Search dashboard
3. Create a new Cloudflare Access application scoped to the new Worker's subdomain (e.g. `search-agent-dataset-b.maratkurbanov.workers.dev`) — copy the AUD value

**Locally:**
1. Add a new `[env.<name>]` block in `wrangler.toml`:
   ```toml
   [env.dataset-b]
   name = "search-agent-dataset-b"
   vars = { CLOUDFLARE_ACCESS_AUD = "<new-aud>", CLOUDFLARE_ACCESS_JWKS_URL = "https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs", ENVIRONMENT = "production", LOG_LEVEL = "warn" }
   ```
2. Build with the new endpoint, then deploy:
   ```bash
   VITE_API_URL=https://<new-uuid>.search.ai.cloudflare.com/ npm run build
   wrangler deploy --env dataset-b
   ```

## Project Structure

```
src/
├── App.jsx         # Main chat application
├── App.css         # Application styling
├── Settings.jsx    # Settings panel component
├── worker.js       # Cloudflare Worker entry point
├── main.jsx        # React entry point
└── index.css       # Base styles

wrangler.toml      # Cloudflare Workers configuration
vite.config.js     # Vite build configuration
package.json       # Project dependencies
```

## Technologies

- **React 19** - UI framework
- **Vite 5** - Fast build tool
- **Cloudflare Workers** - Serverless deployment
- **Wrangler** - Workers CLI
- **JavaScript/JSX** - No TypeScript
- **@cloudflare/ai-search-snippet** - AI search Web Component

## Deployment Checklist

**First deployment (or new dataset):**
- [ ] Create AI Search index and copy endpoint UUID
- [ ] Configure system prompt in AI Search dashboard
- [ ] Create Cloudflare Access application, copy AUD value
- [ ] Add `[env.<name>]` block to `wrangler.toml` with new name + AUD
- [ ] Build: `VITE_API_URL=https://<uuid>.search.ai.cloudflare.com/ npm run build`
- [ ] Deploy: `wrangler deploy --env <name>`
- [ ] Test deployed application

**Updating existing deployment:**
- [ ] Run `npm run build` (picks up `VITE_API_URL` from `.env`)
- [ ] Run `npm run worker:deploy` (deploys to `production` env)

## Development Notes

- The Web Component is imported as a side-effect in `App.jsx`
- CSS variables handle theme switching (light/dark mode)
- Settings are passed as data attributes to the chat component
- All static assets are served from Cloudflare's edge network
- HTML cache is set to no-cache for latest version
- CSS/JS are cached aggressively (1 hour)