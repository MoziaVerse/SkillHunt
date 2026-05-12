import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ImportOptions {
  sourceRoot?: URL;
  destinationRoot?: URL;
  overwrite?: boolean;
  visibility?: 'public' | 'private';
  log?: (msg: string) => void;
}

interface ImportedFile {
  path: string;
  content: string;
}

interface SkillMeta {
  visibility: 'public' | 'private';
  tags: string[];
}

interface ImportSummary {
  imported: number;
  skippedSkills: number;
  skippedFiles: number;
}

const DEFAULT_SOURCE_ROOT = new URL('file:///Users/linsoap/.agents/skills/');
const DEFAULT_DESTINATION_ROOT = new URL('../builtin-skills/', import.meta.url);
const META_FILE = 'skill.json';
const REQUIRED_SKILL_FILE = 'SKILL.md';
const SKIPPED_DIRS = new Set(['__pycache__', 'node_modules']);
const SKIPPED_EXTENSIONS = new Set(['.pyc', '.so', '.dylib', '.dll', '.exe']);
const frontmatterLine = /^([A-Za-z0-9_-]+):\s*(.+)$/;

function parseFrontmatter(md: string): Record<string, unknown> {
  const lines = md.split('\n');
  if (lines[0] !== '---') return {};
  const out: Record<string, unknown> = {};
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '---') break;
    const match = line?.match(frontmatterLine);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (!key || value === undefined) continue;
    out[key] = value.trim();
  }
  return out;
}

function extensionOf(path: string): string {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index).toLowerCase() : '';
}

function shouldSkipDirectory(name: string): boolean {
  return name.startsWith('.') || SKIPPED_DIRS.has(name);
}

function shouldSkipFile(name: string): boolean {
  return name.startsWith('.') || SKIPPED_EXTENSIONS.has(extensionOf(name));
}

function decodeUtf8(buffer: Uint8Array): string | null {
  if (buffer.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

async function collectImportableFiles(
  rootDir: string,
  currentDir: string,
  log: (msg: string) => void,
): Promise<{ files: ImportedFile[]; skippedFiles: number }> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: ImportedFile[] = [];
  let skippedFiles = 0;

  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) {
      skippedFiles += 1;
      continue;
    }

    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, fullPath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        skippedFiles += 1;
        continue;
      }
      const nested = await collectImportableFiles(rootDir, fullPath, log);
      files.push(...nested.files);
      skippedFiles += nested.skippedFiles;
      continue;
    }

    if (!entry.isFile()) continue;
    if (relativePath === META_FILE) continue;
    if (shouldSkipFile(entry.name)) {
      skippedFiles += 1;
      continue;
    }

    const content = decodeUtf8(await readFile(fullPath));
    if (content === null) {
      skippedFiles += 1;
      log(`[import-builtin-skills] skip binary '${relativePath}'`);
      continue;
    }

    files.push({ path: relativePath, content });
  }

  return { files, skippedFiles };
}

async function importSingleSkill(
  sourceSkillDir: string,
  destinationSkillDir: string,
  options: Required<Pick<ImportOptions, 'overwrite' | 'visibility' | 'log'>>,
): Promise<{ imported: boolean; skippedFiles: number }> {
  const { files, skippedFiles } = await collectImportableFiles(
    sourceSkillDir,
    sourceSkillDir,
    options.log,
  );
  const skillMd = files.find((file) => file.path === REQUIRED_SKILL_FILE)?.content;
  if (!skillMd) {
    options.log(`[import-builtin-skills] skip '${sourceSkillDir}': missing ${REQUIRED_SKILL_FILE}`);
    return { imported: false, skippedFiles };
  }

  const frontmatter = parseFrontmatter(skillMd);
  const name = typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '';
  const description =
    typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '';
  if (!name || !description) {
    options.log(
      `[import-builtin-skills] skip '${sourceSkillDir}': missing frontmatter name/description`,
    );
    return { imported: false, skippedFiles };
  }

  if (options.overwrite) {
    await rm(destinationSkillDir, { recursive: true, force: true });
  } else {
    try {
      await readdir(destinationSkillDir);
      options.log(
        `[import-builtin-skills] skip '${sourceSkillDir}': destination '${destinationSkillDir}' already exists`,
      );
      return { imported: false, skippedFiles };
    } catch {
      // destination missing, continue
    }
  }

  await mkdir(destinationSkillDir, { recursive: true });
  const meta: SkillMeta = { visibility: options.visibility, tags: [] };
  await writeFile(
    join(destinationSkillDir, META_FILE),
    `${JSON.stringify(meta, null, 2)}\n`,
    'utf8',
  );
  for (const file of files) {
    const target = join(destinationSkillDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
  options.log(
    `[import-builtin-skills] ✓ ${relative(fileURLToPath(DEFAULT_SOURCE_ROOT), sourceSkillDir)} (${files.length} files)`,
  );
  return { imported: true, skippedFiles };
}

export async function importLocalSkills(options: ImportOptions = {}): Promise<ImportSummary> {
  const sourceRoot = fileURLToPath(options.sourceRoot ?? DEFAULT_SOURCE_ROOT);
  const destinationRoot = fileURLToPath(options.destinationRoot ?? DEFAULT_DESTINATION_ROOT);
  const overwrite = options.overwrite ?? false;
  const visibility = options.visibility ?? 'public';
  const log = options.log ?? console.log;

  const entries = await readdir(sourceRoot, { withFileTypes: true });
  let imported = 0;
  let skippedSkills = 0;
  let skippedFiles = 0;

  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (shouldSkipDirectory(entry.name)) continue;
    const sourceSkillDir = join(sourceRoot, entry.name);
    const destinationSkillDir = join(destinationRoot, entry.name);
    const result = await importSingleSkill(sourceSkillDir, destinationSkillDir, {
      overwrite,
      visibility,
      log,
    });
    skippedFiles += result.skippedFiles;
    if (result.imported) imported += 1;
    else skippedSkills += 1;
  }

  return { imported, skippedSkills, skippedFiles };
}

if (import.meta.main) {
  const summary = await importLocalSkills();
  console.log(
    `[import-builtin-skills] done (${summary.imported} imported, ${summary.skippedSkills} skipped, ${summary.skippedFiles} skipped files)`,
  );
}
