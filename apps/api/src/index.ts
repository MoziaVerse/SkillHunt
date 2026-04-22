import { Hono } from 'hono';
import { apiRoute } from './routes/api';
import { wellknownRoute } from './routes/wellknown';

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true, service: 'skillhub-api' }));

app.route('/.well-known', wellknownRoute);
app.route('/api', apiRoute);

const port = Number(Bun.env.PORT ?? 3333);

export default {
  port,
  fetch: app.fetch,
};

console.log(`[skillhub-api] listening on http://localhost:${port}`);
