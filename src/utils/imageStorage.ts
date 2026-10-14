
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

function extensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/svg+xml') return 'svg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/png') return 'png';
  return 'img';
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_PATTERN.test(value);
}

export async function uploadImageFile(
  file: File,
  folder: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem.');
  }

  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('A imagem excede o limite de 15 MB.');
  }

  const safeFolder = folder
    .split('/')
    .filter(Boolean)
    .map(safeSegment)
    .join('/');

  const fileName =
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.` +
    extensionFromMime(file.type);

  const imageRef = ref(storage, `${safeFolder}/${fileName}`);

  await uploadBytes(imageRef, file, {
    contentType: file.type,
  });

  return getDownloadURL(imageRef);
}

export async function uploadImageDataUrl(
  dataUrl: string,
  folder: string,
): Promise<string> {
  if (!isImageDataUrl(dataUrl)) {
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
    throw new Error('Formato de imagem inválido ou não suportado.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  if (!blob.type.startsWith('image/')) {
    throw new Error('O conteúdo recebido não é uma imagem válida.');
  }

  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('A imagem excede o limite de 15 MB.');
  }

  const safeFolder = folder
    .split('/')
    .filter(Boolean)
    .map(safeSegment)
    .join('/');

  const extension = extensionFromMime(blob.type);
  const fileName =
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const imageRef = ref(storage, `${safeFolder}/${fileName}`);

  await uploadBytes(imageRef, blob, {
    contentType: blob.type,
  });

  return getDownloadURL(imageRef);
}
