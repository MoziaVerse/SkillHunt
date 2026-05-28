import { Buffer } from 'node:buffer';
import { mimeFromPath } from './content-type';

export type SkillFileStorageKind = 'inline' | 'oss';

export interface SkillFileSnapshotEntry {
  path: string;
  storageKind?: SkillFileStorageKind | null;
  content?: string | null;
  objectKey?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
}

export interface SkillFilePayload {
  path: string;
  storageKind: SkillFileStorageKind;
  content: string;
  objectKey: string | null;
  contentType: string | null;
  sizeBytes: number;
}

function textSize(content: string) {
  return Buffer.byteLength(content, 'utf8');
}

export function normalizeSkillFileEntry(file: SkillFileSnapshotEntry): SkillFilePayload {
  const storageKind: SkillFileStorageKind = file.storageKind === 'oss' ? 'oss' : 'inline';
  const content = storageKind === 'inline' ? (file.content ?? '') : '';
  const inferredSize = storageKind === 'inline' ? textSize(content) : 0;

  return {
    path: file.path,
    storageKind,
    content,
    objectKey: storageKind === 'oss' ? (file.objectKey ?? null) : null,
    contentType: file.contentType ?? null,
    sizeBytes: file.sizeBytes && file.sizeBytes > 0 ? file.sizeBytes : inferredSize,
  };
}

export function textSkillFile(path: string, content: string): SkillFilePayload {
  return {
    path,
    storageKind: 'inline',
    content,
    objectKey: null,
    contentType: mimeFromPath(path),
    sizeBytes: textSize(content),
  };
}

export function ossSkillFile(
  path: string,
  input: { objectKey: string; contentType?: string | null; sizeBytes: number },
): SkillFilePayload {
  return {
    path,
    storageKind: 'oss',
    content: '',
    objectKey: input.objectKey,
    contentType: input.contentType || mimeFromPath(path),
    sizeBytes: input.sizeBytes,
  };
}

export function skillFileInlineBody(file: SkillFileSnapshotEntry): string {
  const normalized = normalizeSkillFileEntry(file);
  if (normalized.storageKind !== 'inline') {
    throw new Error('OSS-backed skill file has no inline body');
  }
  return normalized.content;
}

export function skillFileContentType(file: SkillFileSnapshotEntry): string {
  const normalized = normalizeSkillFileEntry(file);
  return normalized.contentType || mimeFromPath(normalized.path);
}

export function skillFileFingerprint(file: SkillFileSnapshotEntry): string {
  const normalized = normalizeSkillFileEntry(file);
  return [
    normalized.storageKind,
    normalized.contentType ?? '',
    String(normalized.sizeBytes),
    normalized.storageKind === 'oss' ? (normalized.objectKey ?? '') : normalized.content,
  ].join('\0');
}
