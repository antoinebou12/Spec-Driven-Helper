import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui';
import { useL } from '../i18n';

/** Rasterises SVG markup to a PNG blob at `scale` times its intrinsic size. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = (img.naturalWidth || 1200) * scale;
    canvas.height = (img.naturalHeight || 630) * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const imageFileName = (name: string, extension: string) =>
  `${
    name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'overview'
  }-overview.${extension}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Overview card image: live preview with SVG and PNG downloads. */
export function OverviewImage({ src, name }: { src: string; name: string }) {
  const l = useL();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const png = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(src, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      save(await svgToPng(await response.text()), imageFileName(name, 'png'));
    } catch (e) {
      setError(l(`The PNG could not be created: ${(e as Error).message}`, `Le PNG n’a pas pu être créé : ${(e as Error).message}`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card overview-image" aria-labelledby="overview-image-title">
      <h3 id="overview-image-title">
        <ImageIcon size={18} aria-hidden /> {l('Overview image', 'Image de synthèse')}
      </h3>
      <p className="muted small">
        {l(
          'A shareable card with readiness, completeness per module and the stack — for slides, wikis and pull requests.',
          'Une carte à partager avec la préparation, la complétude par module et la pile — pour les présentations, wikis et demandes de fusion.',
        )}
      </p>
      <img
        className="overview-preview"
        src={src}
        width={1200}
        height={630}
        loading="lazy"
        alt={l('Specification overview: readiness, completeness per module and stack', 'Synthèse de la spécification : préparation, complétude par module et pile')}
      />
      <div className="inline-actions">
        <Button asChild>
          <a href={src} download={imageFileName(name, 'svg')}>
            <Download size={15} aria-hidden /> SVG
          </a>
        </Button>
        <Button onClick={png} disabled={busy} aria-busy={busy}>
          <Download size={15} aria-hidden /> {busy ? l('Creating PNG…', 'Création du PNG…') : 'PNG'}
        </Button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
