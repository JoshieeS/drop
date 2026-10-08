export function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

export const isVideo = (f: { type: string }) => f.type.startsWith('video/');
export const isMedia = (f: { type: string }) =>
  f.type.startsWith('image/') || f.type.startsWith('video/');