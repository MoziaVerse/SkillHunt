const MIME_MAP: Record<string, string> = {
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
};

export function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'text/plain; charset=utf-8';
}
