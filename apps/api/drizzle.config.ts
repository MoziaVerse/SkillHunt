import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set (check apps/api/.env)');
}

const sqlitePath = url.startsWith('file:') ? url.slice('file:'.length) : url;

export default {
  schema: ['./src/db/schema.ts', './src/db/auth-schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: sqlitePath },
} satisfies Config;
