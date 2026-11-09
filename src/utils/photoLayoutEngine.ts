import { PhotoItem, PhotoFit } from '../types';

export interface ComputedPhotoFrame {
  photo: PhotoItem;
  index: number;
  // Relative position and dimensions in percentage (0 to 100)
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  // Recommended display properties
  fit: PhotoFit;
  objectPosition: string;
  isPortrait: boolean;
  aspectRatio: number; // width / height
  cssAspectRatio?: string;
}

export type SmartCompositionPreset = 'auto' | 'editorial' | 'side-by-side' | 'stacked' | 'grid' | 'mosaic';

/**
 * Heuristically detects or estimates the aspect ratio of a photo
 * Defaults to 16:9 (1.77) for standard photos, or uses user-set aspectRatio.
 */
export function getPhotoAspectRatio(photo: PhotoItem): number {
  if (photo.aspectRatio === '16/9') return 16 / 9;
  if (photo.aspectRatio === '4/3') return 4 / 3;
  if (photo.aspectRatio === '1/1') return 1;
  if (photo.scaleX && photo.scaleY && photo.scaleY > 0) {
    return photo.scaleX / photo.scaleY;
  }
  // Standard default for academic / documentary photography
  return 16 / 9;
}

/**
 * Intelligent photo layout engine that computes harmonious, non-distorted
 * frames for 1, 2, 3, 4, 5+ photos.
 * Used identically in:
 * 1. Slide Canvas Editor
 * 2. Presentation Fullscreen Preview
 * 3. PPTX Exporter
 */
export function computePhotoLayout(
  photos: PhotoItem[],
  preset: SmartCompositionPreset = 'auto'
): ComputedPhotoFrame[] {
  if (!photos || photos.length === 0) return [];

  const count = photos.length;
  const GAP_X = 2.5; // horizontal gap percentage
  const GAP_Y = 2.5; // vertical gap percentage

  // 1 PHOTO: Hero Showcase
  if (count === 1) {
    const photo = photos[0];
    const isPortrait = photo.aspectRatio === '4/3' && (photo.scaleY || 1) > (photo.scaleX || 1);
    return [
      {
        photo,
        index: 0,
        leftPercent: 0,
        topPercent: 0,
        widthPercent: 100,
        heightPercent: 100,
        fit: photo.fit || 'contain',
        objectPosition: photo.position || 'center',
        isPortrait,
        aspectRatio: getPhotoAspectRatio(photo),
        cssAspectRatio: photo.aspectRatio || '16/9',
      },
    ];
  }

  // 2 PHOTOS: Adaptive Side-by-Side or Stacked
  if (count === 2) {
    const [p1, p2] = photos;
    const preferStacked = preset === 'stacked';

    if (preferStacked) {
      // 2 Stacked rows
      const itemHeight = (100 - GAP_Y) / 2;
      return [
        {
          photo: p1,
          index: 0,
          leftPercent: 0,
          topPercent: 0,
          widthPercent: 100,
          heightPercent: itemHeight,
          fit: p1.fit || 'cover',
          objectPosition: p1.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p1),
        },
        {
          photo: p2,
          index: 1,
          leftPercent: 0,
          topPercent: itemHeight + GAP_Y,
          widthPercent: 100,
          heightPercent: itemHeight,
          fit: p2.fit || 'cover',
          objectPosition: p2.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p2),
        },
      ];
    }

    // Default: 2 Elegant side-by-side columns
    const itemWidth = (100 - GAP_X) / 2;
    return [
      {
        photo: p1,
        index: 0,
        leftPercent: 0,
        topPercent: 0,
        widthPercent: itemWidth,
        heightPercent: 100,
        fit: p1.fit || 'cover',
        objectPosition: p1.position || 'center',
        isPortrait: true,
        aspectRatio: getPhotoAspectRatio(p1),
      },
      {
        photo: p2,
        index: 1,
        leftPercent: itemWidth + GAP_X,
        topPercent: 0,
        widthPercent: itemWidth,
        heightPercent: 100,
        fit: p2.fit || 'cover',
        objectPosition: p2.position || 'center',
        isPortrait: true,
        aspectRatio: getPhotoAspectRatio(p2),
      },
    ];
  }

  // 3 PHOTOS: Editorial Layout (Hero Left + 2 Stacked Right, or 3 Columns)
  if (count === 3) {
    const [p1, p2, p3] = photos;

    if (preset === 'side-by-side') {
      // 3 Equal columns
      const colWidth = (100 - GAP_X * 2) / 3;
      return photos.map((p, idx) => ({
        photo: p,
        index: idx,
        leftPercent: idx * (colWidth + GAP_X),
        topPercent: 0,
        widthPercent: colWidth,
        heightPercent: 100,
        fit: p.fit || 'cover',
        objectPosition: p.position || 'center',
        isPortrait: true,
        aspectRatio: getPhotoAspectRatio(p),
      }));
    }

    // Default: Editorial Showcase (1 Major Hero left at 58% + 2 Secondary right at 39.5%)
    const heroWidth = 57.5;
    const secondaryWidth = 100 - heroWidth - GAP_X;
    const secondaryHeight = (100 - GAP_Y) / 2;

    return [
      {
        photo: p1,
        index: 0,
        leftPercent: 0,
        topPercent: 0,
        widthPercent: heroWidth,
        heightPercent: 100,
        fit: p1.fit || 'cover',
        objectPosition: p1.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p1),
      },
      {
        photo: p2,
        index: 1,
        leftPercent: heroWidth + GAP_X,
        topPercent: 0,
        widthPercent: secondaryWidth,
        heightPercent: secondaryHeight,
        fit: p2.fit || 'cover',
        objectPosition: p2.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p2),
      },
      {
        photo: p3,
        index: 2,
        leftPercent: heroWidth + GAP_X,
        topPercent: secondaryHeight + GAP_Y,
        widthPercent: secondaryWidth,
        heightPercent: secondaryHeight,
        fit: p3.fit || 'cover',
        objectPosition: p3.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p3),
      },
    ];
  }

  // 4 PHOTOS: Dynamic 2x2 Balanced Matrix
  if (count === 4) {
    const colWidth = (100 - GAP_X) / 2;
    const rowHeight = (100 - GAP_Y) / 2;

    return photos.map((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      return {
        photo: p,
        index: idx,
        leftPercent: col * (colWidth + GAP_X),
        topPercent: row * (rowHeight + GAP_Y),
        widthPercent: colWidth,
        heightPercent: rowHeight,
        fit: p.fit || 'cover',
        objectPosition: p.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p),
      };
    });
  }

  // 5 PHOTOS: Mosaic Composition (Top Row 2 Heroic Photos, Bottom Row 3 Photos)
  if (count === 5) {
    const rowHeight = (100 - GAP_Y) / 2;
    const topColWidth = (100 - GAP_X) / 2;
    const btmColWidth = (100 - GAP_X * 2) / 3;

    return photos.map((p, idx) => {
      if (idx < 2) {
        // Top row (2 photos)
        return {
          photo: p,
          index: idx,
          leftPercent: idx * (topColWidth + GAP_X),
          topPercent: 0,
          widthPercent: topColWidth,
          heightPercent: rowHeight,
          fit: p.fit || 'cover',
          objectPosition: p.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p),
        };
      } else {
        // Bottom row (3 photos)
        const btmIdx = idx - 2;
        return {
          photo: p,
          index: idx,
          leftPercent: btmIdx * (btmColWidth + GAP_X),
          topPercent: rowHeight + GAP_Y,
          widthPercent: btmColWidth,
          heightPercent: rowHeight,
          fit: p.fit || 'cover',
          objectPosition: p.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p),
        };
      }
    });
  }

  // 6+ PHOTOS: 3 Columns x 2 Rows (or responsive grid)
  const cols = 3;
  const rows = Math.ceil(Math.min(count, 6) / cols);
  const cellWidth = (100 - GAP_X * (cols - 1)) / cols;
  const cellHeight = (100 - GAP_Y * (rows - 1)) / rows;

  return photos.slice(0, 6).map((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      photo: p,
      index: idx,
      leftPercent: col * (cellWidth + GAP_X),
      topPercent: row * (cellHeight + GAP_Y),
      widthPercent: cellWidth,
      heightPercent: cellHeight,
      fit: p.fit || 'cover',
      objectPosition: p.position || 'center',
      isPortrait: false,
      aspectRatio: getPhotoAspectRatio(p),
    };
  });
}
