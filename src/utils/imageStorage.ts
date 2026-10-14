
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

import { storage } from '../firebase';

const DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i;

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'item';
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_PATTERN.test(value);
}

export async function uploadImageDataUrl(
  dataUrl: string,
  folder: string
): Promise<string> {
  if (/^https?:\/\//i.test(dataUrl)) {
    return dataUrl;
  }

  if (!isImageDataUrl(dataUrl)) {
    throw new Error('Formato de imagem inválido.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  if (!blob.type.startsWith('image/')) {
    throw new Error('O arquivo não é uma imagem válida.');
  }

  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('A imagem excede o limite de 15 MB.');
  }

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };

  const extension = extensions[blob.type] || 'img';
  const safeFolder = folder.split('/').map(safeSegment).join('/');
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const imageRef = ref(storage, `${safeFolder}/${fileName}`);

  await uploadBytes(imageRef, blob, {
    contentType: blob.type,
  });

  return getDownloadURL(imageRef);
}
