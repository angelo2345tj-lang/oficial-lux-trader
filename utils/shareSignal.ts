import html2canvas from 'html2canvas';

export async function captureElementAsPng(el: HTMLElement): Promise<Blob | null> {
  const canvas = await html2canvas(el, {
    backgroundColor: '#020204',
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 8000,
    onclone: (doc) => {
      const cloned = doc.querySelector('[data-share-export]') as HTMLElement | null;
      if (cloned) {
        cloned.style.position = 'fixed';
        cloned.style.left = '0';
        cloned.style.top = '0';
        cloned.style.opacity = '1';
      }
    },
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
  });
}

export async function shareSignalImage(
  el: HTMLElement,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded'> {
  const blob = await captureElementAsPng(el);
  if (!blob) throw new Error('Falha ao gerar imagem');

  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title,
      text: title,
      files: [file],
    });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
