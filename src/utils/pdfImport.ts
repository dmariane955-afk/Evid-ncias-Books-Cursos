import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ActivityType, PhotoItem } from '../types';
import { compressImageToDataUrl } from '../services/storageService';
import { generateActivityObjective } from './aiObjective';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedPdfActivityDraft {
  id: string;
  pageNumber: number;
  selected: boolean;
  isStructuralPage: boolean;
  structuralReason?: string;
  title: string;
  date: string;
  time: string;
  activityType: ActivityType;
  objective: string;
  complementaryText: string;
  photos: PhotoItem[];
  pagePreviewUrl: string;
  rawTextSnippet: string;
}

interface TextLine {
  text: string;
  fontSize: number;
  y: number;
}

const PORTUGUESE_MONTHS: Record<string, string> = {
  janeiro: '01',
  jan: '01',
  fevereiro: '02',
  fev: '02',
  março: '03',
  marco: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  maio: '05',
  mai: '05',
  junho: '06',
  jun: '06',
  julho: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  setembro: '09',
  set: '09',
  outubro: '10',
  out: '10',
  novembro: '11',
  nov: '11',
  dezembro: '12',
  dez: '12',
};

function parseDateFromText(text: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (!text) return today;

  // 1. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](20\d{2}|19\d{2})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 2. YYYY-MM-DD
  const ymdMatch = text.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // 3. Portuguese Month + Year (e.g. "Março 2023", "Abril de 2024")
  const monthNamesPattern = Object.keys(PORTUGUESE_MONTHS).join('|');
  const monthYearRegex = new RegExp(`\\b(${monthNamesPattern})\\s*(?:de\\s+|[/\\-]\\s*)?(20\\d{2})\\b`, 'i');
  const myMatch = text.match(monthYearRegex);
  if (myMatch) {
    const monthKey = myMatch[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const monthNum =
      PORTUGUESE_MONTHS[myMatch[1].toLowerCase()] || PORTUGUESE_MONTHS[monthKey] || '01';
    return `${myMatch[2]}-${monthNum}-01`;
  }

  return today;
}

function parseTimeFromText(text: string): string {
  const match = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return '14:00';
}

function detectActivityType(text: string): ActivityType {
  if (/sustentab|ecolog|recicl|meio ambiente|tampinha|descarte|ambienta/i.test(text)) {
    return 'Atividade de sustentabilidade';
  }
  if (/arrecada|doa[çc][ãa]o|doa[çc][õo]es|solid[áa]ri|p[áa]scoa|cotolengo|agasalho|campanha/i.test(text)) {
    return 'Atividade de arrecadação';
  }
  if (/interdisciplinar|colaborativ|integrador|multidisciplinar/i.test(text)) {
    return 'Atividade colaborativa interdisciplinar';
  }
  return 'Atividade regular';
}

function isBoilerplateLine(line: string): boolean {
  const clean = line.trim();
  if (!clean || clean.length < 2) return true;
  if (/^slide\s+\d+\s+de\s+\d+$/i.test(clean)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(clean)) return true;
  if (/^\d{1,3}$/.test(clean)) return true;
  if (/^(est[áa]cio|curitiba|fatec|polo\s+curitiba|polo\s+fatec|per[íi]odo\s+20\d{2})/i.test(clean)) return true;
  if (/^(registro das a[çc][õo]es|impacto formativo|dcn|evid[êe]ncia|acad[êe]micos)$/i.test(clean)) return true;
  if (/^(campus universit[áa]rio|relat[óo]rio de evid[êe]ncias)$/i.test(clean)) return true;
  if (/^(data:|hor[áa]rio:|local:|docente:|curso:)/i.test(clean)) return true;
  return false;
}

function detectStructuralPage(fullText: string, pageNumber: number, imageCount: number): { isStructural: boolean; reason?: string } {
  const lower = fullText.toLowerCase();
  if (pageNumber === 1 && (/book de evid[êe]ncias|capa oficial|coordena[çc][ãa]o de curso|per[íi]odo letivo/i.test(lower))) {
    return { isStructural: true, reason: 'Capa identificada automaticamente' };
  }
  if (/^\s*sum[áa]rio|[íi]ndice anal[íi]tico|estrutura de apresenta[çc][ãa]o/i.test(lower)) {
    return { isStructural: true, reason: 'Sumário identificado automaticamente' };
  }
  if (/informa[çc][õo]es institucionais|encerramento do book|fale conosco/i.test(lower) && imageCount <= 1) {
    return { isStructural: true, reason: 'Página de contatos/encerramento' };
  }
  if (/apresenta[çc][ãa]o do curso|diretrizes curriculares|corpo docente/i.test(lower) && imageCount === 0) {
    return { isStructural: true, reason: 'Slide institucional sem fotos' };
  }
  return { isStructural: false };
}

function extractLinesFromTextContent(items: any[]): TextLine[] {
  const rows = new Map<number, Array<{ x: number; str: string; fontSize: number }>>();

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const text = item.str.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [12, 0, 0, 12, 0, 0];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    const fontSize = Math.max(Math.hypot(transform[0] || 0, transform[1] || 0), item.height || 10);

    // Group items within ~5pt vertically on the same visual line
    const bucketY = Math.round(y / 5) * 5;
    if (!rows.has(bucketY)) rows.set(bucketY, []);
    rows.get(bucketY)!.push({ x, str: item.str, fontSize });
  }

  const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
  const lines: TextLine[] = [];

  for (const y of sortedY) {
    const lineItems = rows.get(y)!.sort((a, b) => a.x - b.x);
    const joined = lineItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    const maxFont = Math.max(...lineItems.map((i) => i.fontSize));
    lines.push({ text: joined, fontSize: maxFont, y });
  }

  return lines;
}

function imageObjectToDataUrl(imgObj: any): string | null {
  if (!imgObj) return null;

  try {
    // 1. PDF.js v4/v5 ImageBitmap support
    const bitmap: ImageBitmap | HTMLImageElement | HTMLCanvasElement | null =
      imgObj.bitmap ||
      (typeof ImageBitmap !== 'undefined' && imgObj instanceof ImageBitmap ? imgObj : null) ||
      (typeof HTMLImageElement !== 'undefined' && imgObj instanceof HTMLImageElement ? imgObj : null) ||
      (typeof HTMLCanvasElement !== 'undefined' && imgObj instanceof HTMLCanvasElement ? imgObj : null);

    if (bitmap) {
      const w = (bitmap as any).width || imgObj.width;
      const h = (bitmap as any).height || imgObj.height;
      if (!w || !h || w < 90 || h < 70 || w * h < 12000) return null;
      const ratio = w / h;
      if (ratio > 6 || ratio < 1 / 6) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap as any, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.85);
    }

    // 2. Raw pixel buffer (RGB / RGBA / Grayscale)
    const width = imgObj.width;
    const height = imgObj.height;
    const data: Uint8Array | Uint8ClampedArray | undefined = imgObj.data;
    if (!data || !width || !height || width < 90 || height < 70 || width * height < 12000) return null;
    const ratio = width / height;
    if (ratio > 6 || ratio < 1 / 6) return null;

    const rgba = new Uint8ClampedArray(width * height * 4);
    const totalPixels = width * height;

    if (data.length === totalPixels * 4) {
      rgba.set(data);
    } else if (data.length === totalPixels * 3) {
      for (let i = 0, j = 0; i < totalPixels; i++, j += 3) {
        const k = i * 4;
        rgba[k] = data[j];
        rgba[k + 1] = data[j + 1];
        rgba[k + 2] = data[j + 2];
        rgba[k + 3] = 255;
      }
    } else if (data.length === totalPixels) {
      for (let i = 0; i < totalPixels; i++) {
        const v = data[i];
        const k = i * 4;
        rgba[k] = v;
        rgba[k + 1] = v;
        rgba[k + 2] = v;
        rgba[k + 3] = 255;
      }
    } else {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = new ImageData(rgba, width, height);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

function quickDataUrlSignature(dataUrl: string): string {
  const len = dataUrl.length;
  const sampleA = dataUrl.slice(30, 90);
  const sampleB = dataUrl.slice(Math.max(0, Math.floor(len / 2)), Math.max(0, Math.floor(len / 2)) + 60);
  return `${len}_${sampleA}_${sampleB}`;
}

export async function extractActivitiesFromPdf(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<ParsedPdfActivityDraft[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  interface RawPageExtracted {
    pageNumber: number;
    lines: TextLine[];
    fullText: string;
    rawImages: Array<{ sig: string; dataUrl: string }>;
    pagePreviewUrl: string;
  }

  const rawPages: RawPageExtracted[] = [];
  const signaturePageCounts = new Map<string, number>();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);
    const page = await pdf.getPage(pageNum);

    // 1. Text
    const textContent = await page.getTextContent();
    const lines = extractLinesFromTextContent(textContent.items || []);
    const fullText = lines.map((l) => l.text).join('\n');

    // 2. Render offscreen so all page images decode into page.objs + generate page preview
    const viewport = page.getViewport({ scale: 1.25 });
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = Math.max(1, Math.floor(viewport.width));
    renderCanvas.height = Math.max(1, Math.floor(viewport.height));
    const renderCtx = renderCanvas.getContext('2d');

    if (renderCtx) {
      await page.render({
        canvasContext: renderCtx,
        viewport,
        canvas: renderCanvas,
      }).promise;
    }

    const pagePreviewRaw = renderCanvas.toDataURL('image/jpeg', 0.72);
    const pagePreviewUrl = (await compressImageToDataUrl(pagePreviewRaw, 1280, 720, 0.72)) || pagePreviewRaw;

    // 3. Extract individual embedded images from operator list
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;
    const seenOnPage = new Set<string>();
    const rawImages: Array<{ sig: string; dataUrl: string }> = [];

    for (let idx = 0; idx < opList.fnArray.length; idx++) {
      const fn = opList.fnArray[idx];
      const args = opList.argsArray[idx];
      let imgObj: any = null;

      if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
        const imgKey = args?.[0];
        if (imgKey) {
          try {
            if (page.objs.has(imgKey)) {
              imgObj = page.objs.get(imgKey);
            } else if (typeof imgKey === 'string' && page.commonObjs.has(imgKey)) {
              imgObj = page.commonObjs.get(imgKey);
            }
          } catch {
            imgObj = null;
          }
        }
      } else if (fn === OPS.paintInlineImageXObject) {
        imgObj = args?.[0];
      }

      if (imgObj) {
        const dataUrl = imageObjectToDataUrl(imgObj);
        if (dataUrl) {
          const sig = quickDataUrlSignature(dataUrl);
          if (!seenOnPage.has(sig)) {
            seenOnPage.add(sig);
            rawImages.push({ sig, dataUrl });
            signaturePageCounts.set(sig, (signaturePageCounts.get(sig) || 0) + 1);
          }
        }
      }
    }

    rawPages.push({
      pageNumber: pageNum,
      lines,
      fullText,
      rawImages,
      pagePreviewUrl,
    });
  }

  // Filter out images repeated identically across many pages (e.g. institutional header logos/watermarks)
  const repeatThreshold = totalPages >= 3 ? Math.max(3, Math.ceil(totalPages * 0.45)) : Infinity;

  const drafts: ParsedPdfActivityDraft[] = [];

  for (const rp of rawPages) {
    const uniquePhotosRaw = rp.rawImages.filter(
      (img) => (signaturePageCounts.get(img.sig) || 0) < repeatThreshold
    );

    const compressedPhotos: PhotoItem[] = [];
    for (let pIdx = 0; pIdx < uniquePhotosRaw.length; pIdx++) {
      const compressed = await compressImageToDataUrl(uniquePhotosRaw[pIdx].dataUrl, 1280, 720, 0.78);
      if (compressed) {
        compressedPhotos.push({
          id: `pdf-p-${rp.pageNumber}-${pIdx}-${Date.now()}`,
          url: compressed,
          caption: 'Registro fotográfico da atividade',
          fit: 'cover',
        });
      }
    }

    const structural = detectStructuralPage(rp.fullText, rp.pageNumber, compressedPhotos.length);
    const meaningfulLines = rp.lines.filter((l) => !isBoilerplateLine(l.text));

    // Title heuristic: largest font size line among first half of meaningful lines
    let title = '';
    if (meaningfulLines.length > 0) {
      const topCandidates = meaningfulLines.slice(0, Math.min(6, meaningfulLines.length));
      const bestTitleLine = topCandidates.reduce((best, curr) =>
        curr.fontSize > best.fontSize + 0.8 ? curr : best
      );
      title = bestTitleLine.text
        .replace(/^(t[íi]tulo|atividade)\s*:\s*/i, '')
        .slice(0, 140)
        .trim();
    }
    if (!title) {
      title = `Atividade da Página ${rp.pageNumber}`;
    }

    const activityType = detectActivityType(rp.fullText);
    const date = parseDateFromText(rp.fullText);
    const time = parseTimeFromText(rp.fullText);

    // Extract body text for objective & complementary impact
    const bodyLines = meaningfulLines
      .filter((l) => l.text !== title && !l.text.startsWith(title))
      .map((l) => l.text);

    let objective = '';
    let complementaryText = '';

    const impactSplitIdx = bodyLines.findIndex((l) => /impacto formativo|resultados obtidos|observa[çc][õo]es/i.test(l));
    if (impactSplitIdx >= 0) {
      objective = bodyLines.slice(0, impactSplitIdx).join(' ').trim();
      complementaryText = bodyLines.slice(impactSplitIdx + 1).join(' ').trim();
    } else {
      objective = bodyLines.join(' ').trim();
    }

    if (objective.length < 15) {
      objective = await generateActivityObjective(activityType, date, time, rp.pageNumber);
    }

    // Ignore completely empty pages with no text and no photos
    if (meaningfulLines.length === 0 && compressedPhotos.length === 0) {
      continue;
    }

    drafts.push({
      id: `draft-p${rp.pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageNumber: rp.pageNumber,
      selected: !structural.isStructural,
      isStructuralPage: structural.isStructural,
      structuralReason: structural.reason,
      title,
      date,
      time,
      activityType,
      objective: objective.slice(0, 900),
      complementaryText: complementaryText.slice(0, 500),
      photos: compressedPhotos,
      pagePreviewUrl: rp.pagePreviewUrl,
      rawTextSnippet: rp.fullText.slice(0, 300),
    });
  }

  return drafts;
}
