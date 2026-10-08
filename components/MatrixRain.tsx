'use client';
import { useEffect, useRef } from 'react';

export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const glyphs = '01アイウエオカキクケコサシスセソ<>/{}=';
    const size = 14;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      drops = Array(Math.ceil(canvas.width / size)).fill(0).map(() => Math.random() * -50);
    };
    resize();
    addEventListener('resize', resize);

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 60) return;               // ~16 fps, easy on batteries
      last = t;
      ctx.fillStyle = 'rgba(10,12,11,0.12)';   // fading trail
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00e676';
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]" />
  );
}