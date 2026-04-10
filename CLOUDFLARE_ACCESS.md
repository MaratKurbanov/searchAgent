# Cloudflare Access Integration

This application is secured with **Cloudflare Access**, which provides authentication and authorization for your Worker.

## What is Cloudflare Access?

Cloudflare Access is a zero-trust security solution that:
- Authenticates users before they access your application
- Validates JWTs (JSON Web Tokens) from Cloudflare's identity provider
- Restricts access to only authorized users in your Cloudflare account
- Works seamlessly with Workers

## Current Configuration

### Access Details

- **Worker Domain**: `search-agent.maratkurbanov.workers.dev`
- **Audience (aud)**: `f189d9a0e6304c25e2e58f56d530cfb3a4a38ac803608d17c9d39453d6c0beea`
- **JWKs URL**: `https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs`
- **Account**: maratkurbanov

### How It Works

1. **User Request** → User visits your Worker domain
2. **Cloudflare Access Check** → Cloudflare checks authentication
3. **JWT Generation** → On successful auth, Cloudflare creates a JWT token
4. **JWT Validation** → Worker validates the JWT signature and claims
5. **Access Granted** → Validated users can access the app

## JWT Validation

The Worker (`src/worker.js`) validates:

- **JWT Signature** - Verifies token authenticity using JWKs
- **Audience (aud)** - Confirms token is for this application
- **Expiration** - Ensures token hasn't expired
- **Key ID (kid)** - Matches the public key used to sign the token

If validation fails, users receive a **401 Unauthorized** response.

## Managing Access

### View/Modify Access Policies

1. Go to **Cloudflare Dashboard**
2. Navigate to **Access > Applications**
3. Find **search-agent** application
4. Edit policies to add/remove users or groups

### Add Users

Access is limited to users in your Cloudflare account. To grant access:

1. Go to **Teams > Members**
2. Invite team members with email invitations
3. Members can authenticate with their identity provider (Google, Microsoft, etc.)

### Access Logs

View who accessed your application:

```bash
# Stream real-time logs
wrangler tail

# Check logs in Cloudflare Dashboard
# Access > Applications > search-agent > Activity
```

## Security Features

✅ **Zero-Trust Authentication** - Users must authenticate before access
✅ **JWT Validation** - Cryptographic verification of tokens
✅ **Audience Validation** - Tokens tied to specific applications
✅ **Key Rotation** - Cloudflare automatically rotates signing keys
✅ **Audit Logging** - All access attempts logged
✅ **Email-based Identity** - Simple user management via email

## Environment Variables

The Worker uses these environment variables (set in `wrangler.toml`):

```toml
CLOUDFLARE_ACCESS_AUD = "f189d9a0e6304c25e2e58f56d530cfb3a4a38ac803608d17c9d39453d6c0beea"
CLOUDFLARE_ACCESS_JWKS_URL = "https://maratkurbanov.cloudflareaccess.com/cdn-cgi/access/certs"
```

## Troubleshooting

### "401 Unauthorized" Error

**Cause**: JWT validation failed

**Solutions**:
1. Ensure you're signed in to Cloudflare Access
2. Check browser cookies for `CF_Authorization` cookie
3. Try clearing cookies and visiting the domain again
4. Check Worker logs: `wrangler tail`

### "Missing Access JWT" Error

**Cause**: No JWT token provided in request

**Solutions**:
1. Ensure Cloudflare Access is configured for this domain
2. Check that you're accessing the correct domain: `search-agent.maratkurbanov.workers.dev`
3. Verify the domain is protected by an Access policy

### Token Expired

**Cause**: JWT token has expired (usually 24 hours)

**Solutions**:
1. Refresh the page (Cloudflare will issue a new token)
2. Clear cookies and visit again
3. Contact your Cloudflare administrator

## Advanced Configuration

### Custom Claims

You can access custom claims from the JWT:

```javascript
const payload = JSON.parse(base64Decode(tokenParts[1]))
// Access claims like:
// payload.email - User email
// payload.sub - Subject (user ID)
// payload.aud - Audience
// payload.exp - Expiration time
// payload.groups - User groups (if configured)
```

### Skip Validation for Specific Paths

Edit `src/worker.js` to bypass Access validation for specific paths:

```javascript
if (pathname === '/health' || pathname === '/status') {
  return fetch(request)
}
```

### Per-Group Access

Configure different access policies for different user groups in Cloudflare Dashboard.

## Deployment

When deploying, ensure Access environment variables are set:

```bash
# These are automatically set in wrangler.toml for all environments
npm run worker:deploy
```

## More Information

- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/)
- [JWT Validation in Workers](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validate-jwt/)
- [Access Policies](https://developers.cloudflare.com/cloudflare-one/policies/access/)
