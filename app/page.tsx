import { MatrixRain } from '@/components/MatrixRain';
import {Uploader} from '@/components/Uploader';

export default function Home() {
  return (
    <>
      <MatrixRain />
      <section className="space-y-6">
        <h1 className="text-lg">
          send files <span className="text-accent">directly</span> between devices
        </h1>
        <p className="text-dim">
          no accounts. no uploads. your photos travel straight from one browser to the other.
        </p>
        <Uploader />
        <div className="cursor text-dim">status: idle</div>
      </section>
    </>
  );
}