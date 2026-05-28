import { fetchUploadedObject } from '../services/s3-storage';
import type { SkillFileSnapshotEntry } from './skill-file-payload';
import {
  normalizeSkillFileEntry,
  skillFileContentType,
  skillFileInlineBody,
} from './skill-file-payload';

export async function createSkillFileResponse(file: SkillFileSnapshotEntry): Promise<Response> {
  const normalized = normalizeSkillFileEntry(file);
  if (normalized.storageKind === 'oss') {
    if (!normalized.objectKey) throw new Error('OSS object key missing');
    const object = await fetchUploadedObject(normalized.objectKey);
    return new Response(object.body, {
      headers: {
        'content-type': normalized.contentType ?? object.contentType ?? skillFileContentType(file),
      },
    });
  }

  return new Response(skillFileInlineBody(normalized), {
    headers: { 'content-type': skillFileContentType(normalized) },
  });
}
