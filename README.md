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

The app uses the Cloudflare AI Search endpoint:

```
https://daf1d29e-1140-4bbf-8f0b-0d6a6d980b32.search.ai.cloudflare.com/
```

To change the endpoint, modify the `API_URL` constant in `src/App.jsx`.

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

- [ ] Update domain in `wrangler.toml`
- [ ] Configure environment variables if needed
- [ ] Run `npm run worker:build` for dry run
- [ ] Review changes in preview
- [ ] Run `npm run worker:deploy` to deploy
- [ ] Test deployed application

## Development Notes

- The Web Component is imported as a side-effect in `App.jsx`
- CSS variables handle theme switching (light/dark mode)
- Settings are passed as data attributes to the chat component
- All static assets are served from Cloudflare's edge network
- HTML cache is set to no-cache for latest version
- CSS/JS are cached aggressively (1 hour)
