import { Hono } from 'hono';
import { OIDC_PROVIDER_ID, auth } from './lib/auth';
import { apiRoute } from './routes/api';
import { wellknownRoute } from './routes/wellknown';

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true, service: 'skillhub-api' }));

// Tiny status endpoint so the web UI can disable the Sign-in button when
// mozia-sso isn't wired yet (avoids a confusing 500 on click).
app.get('/api/auth-status', (c) =>
  c.json({
    ssoConfigured: Boolean(process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
    issuer: process.env.OIDC_ISSUER ?? null,
    providerId: OIDC_PROVIDER_ID,
  }),
);

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.route('/.well-known', wellknownRoute);
app.route('/api', apiRoute);

const port = Number(Bun.env.PORT ?? 3333);

export default {
  port,
  fetch: app.fetch,
};

console.log(`[skillhub-api] listening on http://localhost:${port}`);
