'use client';
import { useEffect, useMemo } from 'react';
import { formatBytes } from '@/lib/format';

type Props = { files: File[]; onRemove?: (index: number) => void };

export function FileList({ files, onRemove }: Props) {
  // One preview URL per file. Recomputed only when the list changes.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  // Free the memory those URLs hold when the list changes or the component unmounts.
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="rounded border border-line bg-panel">
      <ul className="divide-y divide-line">
        {files.map((f, i) => (
          <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-3 px-3 py-2">
            <img src={previews[i]} alt="" className="size-10 shrink-0 ject-cover" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="shrink-0 text-xs text-dim">{formatBytes(f.size)}</span>
            {onRemove && (
              <button
                onClick={() => onRemove(i)}
                aria-label={`remove ${f.name}`}
                className="shrink-0 px-1 text-dim hover:text-err"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-line px-3 py-2 text-xs text-dim">
        <span>{files.length} file{files.length === 1 ? '' : 's'}</span>
        <span>{formatBytes(total)}</span>
      </div>
    </div>
  );
}