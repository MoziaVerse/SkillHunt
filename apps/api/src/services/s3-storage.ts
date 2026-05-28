import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mimeFromPath } from '../lib/content-type';
import { SKILL_BINARY_FILE_MAX_BYTES, VIDEO_UPLOAD_MAX_BYTES } from '../lib/dto';

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_UPLOAD_EXPIRES_SECONDS = 15 * 60;
const DEFAULT_PLAYBACK_EXPIRES_SECONDS = 60 * 60;
const VIDEO_KEY_PREFIX = 'skillhunt/videos';
const SKILL_FILE_KEY_PREFIX = 'skillhunt/skill-files';

export interface S3StorageConfig {
  endpoint: string;
  publicUrl: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface VideoUploadTicket {
  uploadUrl: string;
  objectKey: string;
  videoUrl: string;
  maxSizeBytes: number;
  expiresInSeconds: number;
}

export interface UploadedVideoMetadata {
  objectKey: string;
  videoUrl: string;
  playbackUrl: string;
  size: number;
  contentType: string | null;
  durationSeconds?: number;
}

export interface SkillFileUploadTicket {
  uploadUrl: string;
  objectKey: string;
  maxSizeBytes: number;
  expiresInSeconds: number;
}

export interface UploadedSkillFileMetadata {
  objectKey: string;
  size: number;
  contentType: string | null;
}

export interface UploadedObjectBody {
  body: Uint8Array;
  size: number;
  contentType: string | null;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

export function getS3StorageConfig(): S3StorageConfig | null {
  const endpoint = env('S3_ENDPOINT');
  const bucket = env('S3_BUCKET');
  const accessKeyId = env('S3_ACCESS_KEY_ID') ?? env('AWS_ACCESS_KEY_ID');
  const secretAccessKey = env('S3_SECRET_ACCESS_KEY') ?? env('AWS_SECRET_ACCESS_KEY');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: stripTrailingSlash(endpoint),
    publicUrl: stripTrailingSlash(env('S3_PUBLIC_URL') ?? endpoint),
    bucket,
    region: env('S3_REGION') ?? DEFAULT_REGION,
    accessKeyId,
    secretAccessKey,
  };
}

export function isS3StorageConfigured() {
  return getS3StorageConfig() !== null;
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeKeyPath(key: string) {
  return key.split('/').map(awsEncode).join('/');
}

function objectPath(config: S3StorageConfig, key: string) {
  const endpoint = new URL(config.endpoint);
  const basePath = endpoint.pathname.replace(/\/+$/g, '');
  return `${basePath}/${awsEncode(config.bucket)}/${encodeKeyPath(key)}`.replace(/\/{2,}/g, '/');
}

function objectUrl(baseUrl: string, config: S3StorageConfig, key: string) {
  const url = new URL(baseUrl);
  url.pathname = objectPath({ ...config, endpoint: baseUrl }, key);
  url.search = '';
  return url.toString();
}

function getDateParts(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const amzDate = iso;
  const dateStamp = iso.slice(0, 8);
  return { amzDate, dateStamp };
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function signingKey(config: S3StorageConfig, dateStamp: string) {
  return hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), 's3'),
    'aws4_request',
  );
}

function credentialScope(config: S3StorageConfig, dateStamp: string) {
  return `${dateStamp}/${config.region}/s3/aws4_request`;
}

function canonicalQuery(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');
}

function presignObjectUrl(
  config: S3StorageConfig,
  method: 'GET' | 'PUT',
  key: string,
  expiresInSeconds: number,
) {
  const endpoint = new URL(config.endpoint);
  const { amzDate, dateStamp } = getDateParts();
  const scope = credentialScope(config, dateStamp);
  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = canonicalQuery(params);
  const canonicalRequest = [
    method,
    objectPath(config, key),
    query,
    `host:${endpoint.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(config, dateStamp))
    .update(stringToSign)
    .digest('hex');
  const url = new URL(config.endpoint);
  url.pathname = objectPath(config, key);
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return url.toString();
}

function signHeaders(config: S3StorageConfig, method: 'HEAD' | 'DELETE', key: string) {
  const endpoint = new URL(config.endpoint);
  const { amzDate, dateStamp } = getDateParts();
  const payloadHash = createHash('sha256').update('').digest('hex');
  const headers = {
    host: endpoint.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([header, value]) => `${header}:${value}\n`)
    .join('');
  const canonicalRequest = [
    method,
    objectPath(config, key),
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = credentialScope(config, dateStamp);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(config, dateStamp))
    .update(stringToSign)
    .digest('hex');
  return {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function safeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[/\\]/g, '-')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'demo-video';
}

export function createVideoObjectKey(userId: string, fileName: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ownerSegment = safeSegment(userId) || 'user';
  return `${VIDEO_KEY_PREFIX}/${ownerSegment}/${yyyy}/${mm}/${randomUUID()}-${safeFileName(fileName)}`;
}

export function createSkillFileObjectKey(input: {
  userId: string;
  skillId: string;
  path: string;
}) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ownerSegment = safeSegment(input.userId) || 'user';
  const skillSegment = safeSegment(input.skillId) || 'skill';
  const fileName = input.path.split('/').filter(Boolean).pop() ?? 'asset';
  return `${SKILL_FILE_KEY_PREFIX}/${ownerSegment}/${skillSegment}/${yyyy}/${mm}/${randomUUID()}-${safeFileName(fileName)}`;
}

export function createVideoUploadTicket(input: {
  userId: string;
  fileName: string;
}): VideoUploadTicket {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const objectKey = createVideoObjectKey(input.userId, input.fileName);
  return {
    uploadUrl: presignObjectUrl(config, 'PUT', objectKey, DEFAULT_UPLOAD_EXPIRES_SECONDS),
    objectKey,
    videoUrl: objectUrl(config.publicUrl, config, objectKey),
    maxSizeBytes: VIDEO_UPLOAD_MAX_BYTES,
    expiresInSeconds: DEFAULT_UPLOAD_EXPIRES_SECONDS,
  };
}

export function createSkillFileUploadTicket(input: {
  userId: string;
  skillId: string;
  path: string;
}): SkillFileUploadTicket {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const objectKey = createSkillFileObjectKey(input);
  return {
    uploadUrl: presignObjectUrl(config, 'PUT', objectKey, DEFAULT_UPLOAD_EXPIRES_SECONDS),
    objectKey,
    maxSizeBytes: SKILL_BINARY_FILE_MAX_BYTES,
    expiresInSeconds: DEFAULT_UPLOAD_EXPIRES_SECONDS,
  };
}

export function isVideoObjectKeyForUser(objectKey: string, userId: string) {
  const ownerSegment = safeSegment(userId) || 'user';
  return objectKey.startsWith(`${VIDEO_KEY_PREFIX}/${ownerSegment}/`);
}

export function isSkillFileObjectKeyForSkill(objectKey: string, userId: string, skillId: string) {
  const ownerSegment = safeSegment(userId) || 'user';
  const skillSegment = safeSegment(skillId) || 'skill';
  return objectKey.startsWith(`${SKILL_FILE_KEY_PREFIX}/${ownerSegment}/${skillSegment}/`);
}

async function signedObjectRequest(
  config: S3StorageConfig,
  method: 'HEAD' | 'DELETE',
  key: string,
) {
  return fetch(objectUrl(config.endpoint, config, key), {
    method,
    headers: signHeaders(config, method, key),
  });
}

export async function completeUploadedVideo(
  objectKey: string,
  input: { durationSeconds?: number } = {},
): Promise<UploadedVideoMetadata> {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const response = await signedObjectRequest(config, 'HEAD', objectKey);
  if (!response.ok) {
    throw new Error(`OSS 对象校验失败：${response.status}`);
  }
  const size = Number(response.headers.get('content-length') ?? 0);
  const contentType = response.headers.get('content-type');
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('OSS 对象大小异常');
  }
  if (size > VIDEO_UPLOAD_MAX_BYTES) {
    await signedObjectRequest(config, 'DELETE', objectKey).catch(() => undefined);
    throw new Error('演示视频不能超过 500MB');
  }
  if (contentType && !contentType.toLowerCase().startsWith('video/')) {
    await signedObjectRequest(config, 'DELETE', objectKey).catch(() => undefined);
    throw new Error('请上传视频文件');
  }
  return {
    objectKey,
    videoUrl: objectUrl(config.publicUrl, config, objectKey),
    playbackUrl: presignObjectUrl(config, 'GET', objectKey, DEFAULT_PLAYBACK_EXPIRES_SECONDS),
    size,
    contentType,
    durationSeconds: input.durationSeconds,
  };
}

export async function completeUploadedSkillFile(
  objectKey: string,
  input: { path: string; contentType?: string | null },
): Promise<UploadedSkillFileMetadata> {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const response = await signedObjectRequest(config, 'HEAD', objectKey);
  if (!response.ok) {
    throw new Error(`OSS 对象校验失败：${response.status}`);
  }
  const size = Number(response.headers.get('content-length') ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('OSS 对象大小异常');
  }
  if (size > SKILL_BINARY_FILE_MAX_BYTES) {
    await signedObjectRequest(config, 'DELETE', objectKey).catch(() => undefined);
    throw new Error('单个二进制附件不能超过 5 MB');
  }
  return {
    objectKey,
    size,
    contentType:
      response.headers.get('content-type') ?? input.contentType ?? mimeFromPath(input.path),
  };
}

export async function fetchUploadedObject(objectKey: string): Promise<UploadedObjectBody> {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const response = await fetch(
    presignObjectUrl(config, 'GET', objectKey, DEFAULT_PLAYBACK_EXPIRES_SECONDS),
  );
  if (!response.ok) {
    throw new Error(`OSS 对象读取失败：${response.status}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  return {
    body,
    size: Number(response.headers.get('content-length') ?? body.byteLength),
    contentType: response.headers.get('content-type'),
  };
}

export async function deleteUploadedObject(objectKey: string): Promise<void> {
  const config = getS3StorageConfig();
  if (!config) throw new Error('S3 storage is not configured');
  const response = await signedObjectRequest(config, 'DELETE', objectKey);
  if (!response.ok && response.status !== 404) {
    throw new Error(`OSS 对象删除失败：${response.status}`);
  }
}

export function objectKeyFromManagedVideoUrl(videoUrl: string): string | null {
  const config = getS3StorageConfig();
  if (!config) return null;
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return null;
  }

  const bases = [config.publicUrl, config.endpoint];
  for (const base of bases) {
    const baseUrl = new URL(base);
    if (parsed.origin !== baseUrl.origin) continue;
    const basePath = baseUrl.pathname.replace(/\/+$/g, '');
    const prefix = `${basePath}/${config.bucket}/`.replace(/\/{2,}/g, '/');
    if (!parsed.pathname.startsWith(prefix)) continue;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  }
  return null;
}

export function createDemoVideoPlaybackUrl(videoUrl: string): string | null {
  const config = getS3StorageConfig();
  if (!config) return null;
  const objectKey = objectKeyFromManagedVideoUrl(videoUrl);
  if (!objectKey) return null;
  return presignObjectUrl(config, 'GET', objectKey, DEFAULT_PLAYBACK_EXPIRES_SECONDS);
}
