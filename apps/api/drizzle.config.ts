import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set (check apps/api/.env)');
}

export default {
  schema: ['./src/db/schema.ts', './src/db/auth-schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['skillhub'],
  dbCredentials: { url },
} satisfies Config;
