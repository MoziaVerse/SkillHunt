#!/usr/bin/env bun
/**
 * Database reset script for development.
 * Deletes the SQLite database file and regenerates from schema.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dir, '..');
const dbPath = resolve(appRoot, process.env.DATABASE_URL?.replace('file:', '') || 'data/dev.db');

if (existsSync(dbPath)) {
  console.log(`[db:reset] deleting ${dbPath}`);
  unlinkSync(dbPath);
  console.log('[db:reset] database deleted');
} else {
  console.log('[db:reset] no database file found');
}

console.log('[db:reset] run the following to recreate:');
console.log('  pnpm db:generate');
console.log('  bun run src/db/migrate.ts');
