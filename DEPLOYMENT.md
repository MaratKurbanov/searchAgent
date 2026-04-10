# Deployment Guide - Cloudflare Workers

This guide walks you through deploying the Cloudflare AI Search app to Cloudflare Workers.

## Prerequisites

- Cloudflare account with Workers access
- Domain configured on Cloudflare (or use free `*.workers.dev` domain)
- Node.js and npm installed locally

## Step 1: Install Wrangler

Wrangler is already in `devDependencies`. Ensure it's installed:

```bash
npm install
```

## Step 2: Authenticate with Cloudflare

Login to your Cloudflare account:

```bash
npx wrangler login
```

This will open a browser window to authenticate and create an API token.

## Step 3: Environment Configuration

The `wrangler.toml` has three environments configured for consistency:

### Development (Local Testing)
```bash
npm run worker:dev
```
- **Name**: `search-agent-dev`
- **URL**: `http://localhost:8787`
- **Log Level**: `debug`
- **Features**: Full logging enabled

### Staging (Pre-production Testing)
```bash
wrangler deploy --env staging
```
- **Name**: `search-agent-staging`
- **URL**: `https://staging.example.com`
- **Log Level**: `info`
- **Features**: Logging enabled

### Production (Live)
```bash
npm run worker:deploy
```
- **Name**: `search-agent-prod`
- **URL**: `https://example.com`
- **Log Level**: `warn`
- **Features**: Logging enabled for errors only

All environments share:
- Same build process (Vite)
- Same observability settings
- Same static file serving
- Same Worker code

## Step 4: Configure wrangler.toml

Edit `wrangler.toml` and update:

### Option A: Deploy to your domain

```toml
[[routes]]
pattern = "example.com/*"
zone_name = "example.com"
```

Replace `example.com` with your domain.

### Option B: Use free workers.dev subdomain

```toml
name = "cloudflare-ai-search"
# Remove [[routes]] section
```

Access your app at: `https://cloudflare-ai-search.<your-account>.workers.dev`

## Step 4: Configure Environment Variables (Optional)

If you need environment variables, add to `wrangler.toml`:

```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[env.development]
vars = { ENVIRONMENT = "development" }
```

## Step 5: Test Locally

Run the Worker locally to test:

```bash
npm run worker:dev
```

Access at: `http://localhost:8787`

## Step 6: Deploy

### Deployment Commands by Environment

**Development (local):**
```bash
npm run worker:dev
```

**Staging (preview before production):**
```bash
wrangler deploy --env staging
```

**Production:**
```bash
npm run worker:deploy
# or explicitly:
wrangler deploy --env production
```

### Dry Run (preview without deploying)

```bash
npm run worker:build
```

This builds the app and shows what will be deployed without pushing to production.

## Verification

After deployment:

1. Visit your Worker URL (workers.dev or custom domain)
2. Test the chat interface
3. Adjust settings and verify they work
4. Open browser DevTools to check for any errors
5. Test on mobile devices

## Monitoring

Monitor your Worker:

```bash
wrangler tail
```

This streams real-time logs from your Worker.

## Deployment Consistency

### Shared Configuration (All Environments)

The following settings are **identical across all deployments**:

- **Build Process**: `npm run build` (Vite)
- **Static Files**: Served from `public/` directory
- **Worker Code**: `src/worker.js` (same for all envs)
- **Compatibility Date**: `2024-01-01`
- **Observability**: Logging enabled, traces disabled
- **Performance Limit**: 30 second CPU timeout

### Environment-Specific Configuration

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| **Name** | search-agent-dev | search-agent-staging | search-agent-prod |
| **URL** | localhost:8787 | staging.example.com | example.com |
| **Log Level** | debug | info | warn |
| **Invocation Logs** | ✅ | ✅ | ✅ |

### Consistency Checklist

- [ ] All environments use same build command
- [ ] All environments serve from same `public/` folder
- [ ] All environments have observability enabled
- [ ] Environment variables are set per-environment
- [ ] Log levels match intended environment
- [ ] Routes point to correct domains

## Deployment Checklist

- [ ] Update all domains in `wrangler.toml` (dev, staging, prod)
- [ ] Verify log levels match environment intent
- [ ] Run `npm run worker:build` for dry run
- [ ] Review deployment preview
- [ ] Deploy to staging first: `wrangler deploy --env staging`
- [ ] Test staging deployment thoroughly
- [ ] Deploy to production: `npm run worker:deploy`
- [ ] Verify production deployment with `wrangler tail`

## Rollback

To rollback to a previous deployment:

```bash
wrangler rollback
```

## Troubleshooting

### 401 Unauthorized
- Re-authenticate: `npx wrangler login`
- Check API token has Workers permissions

### 403 Forbidden
- Verify domain is configured on Cloudflare
- Check zone_name in wrangler.toml matches your domain

### Build errors
- Clear build cache: `rm -rf public/`
- Rebuild: `npm run build`

### App not loading
- Check wrangler.toml configuration
- Verify build output in `public/` folder
- Check Worker logs: `wrangler tail`

### Settings not working
- Verify API_URL in `src/App.jsx` is correct
- Check browser console for errors
- Ensure Cloudflare Search AI endpoint is accessible

## Advanced Configuration

### Custom Domain Setup

1. Add domain to Cloudflare (if not already)
2. Point nameservers to Cloudflare
3. Update `wrangler.toml`:
   ```toml
   [[routes]]
   pattern = "yourdomain.com/*"
   zone_name = "yourdomain.com"
   ```
4. Deploy: `npm run worker:deploy`

### Multiple Environments

Deploy to staging and production:

```bash
# Deploy to staging
wrangler deploy --env development

# Deploy to production
wrangler deploy --env production
```

### Custom Analytics

Enable Cloudflare Analytics Engine in wrangler.toml:

```toml
analytics_engine_datasets = ["events"]
```

## Cost

- **Free tier**: 100,000 requests/day
- **Paid plans**: Starting at $5-25/month
- **KV Storage**: Optional, $0.50 per million reads/deletes

Most small to medium deployments fit in the free tier.

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/cli-wrangler/)
- [Cloudflare Search AI](https://developers.cloudflare.com/workers-ai/models/search-ai/)
