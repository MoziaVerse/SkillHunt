import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as authSchema from './auth-schema';
import * as schema from './schema';

const appRoot = resolve(import.meta.dir, '../..');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

function sqlitePath(input: string): string {
  if (input === ':memory:') return input;
  const path = input.startsWith('file:') ? input.slice('file:'.length) : input;
  return resolve(appRoot, path);
}

const dbPath = sqlitePath(connectionString);
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

export const db = drizzle(dbPath, { schema: { ...schema, ...authSchema } });
db.$client.run('PRAGMA foreign_keys = ON');
export * from './schema';
export * from './auth-schema';
