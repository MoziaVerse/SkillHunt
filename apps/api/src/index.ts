import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { OIDC_PROVIDER_ID, auth } from './lib/auth';
import { apiRoute } from './routes/api';
import {
  capabilityWellknownRoute,
  packageWellknownRoute,
  singleSkillWellknownRoute,
  wellknownRoute,
} from './routes/wellknown';

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true, service: 'skillhunt-api' }));

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
app.route('/i', capabilityWellknownRoute);
app.route('/s', singleSkillWellknownRoute);
app.route('/p', packageWellknownRoute);
app.route('/api', apiRoute);

// Serve web SPA static files when WEB_DIST is set (production/test-server).
const webDist = Bun.env.WEB_DIST;
if (webDist) {
  app.use('/*', serveStatic({ root: webDist }));
  // SPA fallback: any unmatched GET → index.html
  app.get('/*', (c) => {
    const file = Bun.file(`${webDist}/index.html`);
    return new Response(file, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
}

const port = Number(Bun.env.PORT ?? 3333);

export default {
  port,
  fetch: app.fetch,
};

console.log(`[skillhunt-api] listening on http://localhost:${port}`);
