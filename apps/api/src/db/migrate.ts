import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

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

const db = drizzle(dbPath);
db.$client.run('PRAGMA foreign_keys = ON');

console.log('[migrate] running migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');
