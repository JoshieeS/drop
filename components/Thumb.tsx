'use client';
import { createElement } from 'react';

type Props = { src: string; video: boolean; large?: boolean };

export function Thumb({ src, video, large = false }: Props) {
  const size = large ? 'aspect-square w-full' : 'size-10 shrink-0';
  const className = `${size} rounded bg-line object-cover`;
  return video
    ? createElement('video', { src: `${src}#t=0.1`, className, muted: true, playsInline: true, preload: 'metadata' })
    : createElement('img', { src, alt: '', className });
}