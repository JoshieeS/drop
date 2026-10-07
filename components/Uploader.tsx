'use client';
import { useState } from 'react';
import { Dropzone } from './DropZone';
import { FileList } from './FileList';

const keyOf = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

export function Uploader() {
  const [files, setFiles] = useState<File[]>([]);

  function add(incoming: File[]) {
    const images = incoming.filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => {
      const seen = new Set(prev.map(keyOf));
      return [...prev, ...images.filter((f) => !seen.has(keyOf(f)))]; // skip duplicates
    });
  }

  const remove = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  if (files.length === 0) return <Dropzone onFiles={add} />;

  return (
    <div className="space-y-4">
      <FileList files={files} onRemove={remove} />
      <Dropzone onFiles={add} compact />

      <div className="flex gap-3">
        <button
          disabled                           // enabled in Step 4
          className="flex-1 border border-accent px-4 py-2 text-accent transition-colors
                     hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-40
                     disabled:hover:bg-transparent disabled:hover:text-accent"
        >
          start sharing →
        </button>
        <button
          onClick={() => setFiles([])}
          className="border border-line px-4 py-2 text-dim hover:border-dim hover:text-fg"
        >
          clear
        </button>
      </div>
    </div>
  );
}