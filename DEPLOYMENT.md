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

## Step 3: Configure wrangler.toml

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

### Dry Run (preview without deploying)

```bash
npm run worker:build
```

This builds the app and shows what will be deployed.

### Deploy to Production

```bash
npm run worker:deploy
```

Once deployed, your app will be live!

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
