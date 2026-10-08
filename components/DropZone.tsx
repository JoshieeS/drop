'use client';
import { useState } from 'react';

type Props = { onFiles: (files: File[]) => void; compact?: boolean };

export function Dropzone({ onFiles, compact = false }: Props) {
  const [over, setOver] = useState(false);

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`block cursor-pointer rounded border border-dashed text-center transition-colors
        ${compact ? 'px-4 py-4' : 'px-6 py-16'}
        ${over ? 'border-accent bg-accent/5' : 'border-line hover:border-dim'}`}
    >
      <span className={compact ? 'text-dim' : 'cursor'}>
        {compact ? '+ add more' : 'drop photos or videos, or tap to select'}
      </span>
      {!compact && (
        <div className="mt-2 text-xs text-dim">files stay on this device until a peer connects</div>
      )}
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';   // lets you re-select the same file
        }}
      />
    </label>
  );
}