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
 * Normalizes any legacy or variant layout preset strings to standard presets
 */
export function normalizePreset(preset?: string): 'auto' | 'editorial' | 'side-by-side' | 'stacked' | 'grid' {
  if (!preset || preset === 'auto') return 'auto';
  const lower = preset.toLowerCase().trim();
  if (lower === 'editorial' || lower === 'split-70-30') return 'editorial';
  if (lower === 'side-by-side' || lower === 'split-50-50') return 'side-by-side';
  if (lower === 'stacked') return 'stacked';
  if (lower === 'grid' || lower === 'grid-3' || lower === 'mosaic' || lower === 'gallery-4') return 'grid';
  return 'auto';
}

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
  return 16 / 9;
}

/**
 * Intelligent photo layout engine that computes harmonious, non-distorted
 * frames for 1, 2, 3, 4, 5, 6+ photos.
 * Used identically in:
 * 1. Slide Canvas Editor
 * 2. Presentation Fullscreen Preview
 * 3. PPTX Exporter
 * 4. Slide Thumbnails Preview
 */
export function computePhotoLayout(
  photos: PhotoItem[],
  rawPreset: string = 'auto'
): ComputedPhotoFrame[] {
  if (!photos || photos.length === 0) return [];

  const preset = normalizePreset(rawPreset);
  const count = photos.length;
  const GAP_X = 2.0; // horizontal gap percentage
  const GAP_Y = 2.5; // vertical gap percentage

  // ==========================================
  // 1 PHOTO
  // ==========================================
  if (count === 1) {
    const photo = photos[0];
    const isPortrait = photo.aspectRatio === '4/3' && (photo.scaleY || 1) > (photo.scaleX || 1);

    if (preset === 'editorial') {
      return [
        {
          photo,
          index: 0,
          leftPercent: 4,
          topPercent: 3,
          widthPercent: 92,
          heightPercent: 94,
          fit: photo.fit || 'contain',
          objectPosition: photo.position || 'center',
          isPortrait,
          aspectRatio: getPhotoAspectRatio(photo),
        },
      ];
    }

    if (preset === 'side-by-side') {
      return [
        {
          photo,
          index: 0,
          leftPercent: 0,
          topPercent: 0,
          widthPercent: 78,
          heightPercent: 100,
          fit: photo.fit || 'contain',
          objectPosition: photo.position || 'center',
          isPortrait,
          aspectRatio: getPhotoAspectRatio(photo),
        },
      ];
    }

    if (preset === 'stacked') {
      return [
        {
          photo,
          index: 0,
          leftPercent: 0,
          topPercent: 10,
          widthPercent: 100,
          heightPercent: 80,
          fit: photo.fit || 'cover',
          objectPosition: photo.position || 'center',
          isPortrait,
          aspectRatio: getPhotoAspectRatio(photo),
        },
      ];
    }

    // Default & auto: 100% full coverage
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

  // ==========================================
  // 2 PHOTOS
  // ==========================================
  if (count === 2) {
    const [p1, p2] = photos;

    if (preset === 'stacked') {
      // 2 Stacked horizontal rows
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

    if (preset === 'editorial') {
      // 1 Major Hero (67%) + 1 Secondary (31%)
      const heroWidth = 67;
      const secondaryWidth = 100 - heroWidth - GAP_X;
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
          heightPercent: 100,
          fit: p2.fit || 'cover',
          objectPosition: p2.position || 'center',
          isPortrait: true,
          aspectRatio: getPhotoAspectRatio(p2),
        },
      ];
    }

    if (preset === 'grid') {
      // 2 Cards with centered breathing room
      const itemWidth = (96 - GAP_X) / 2;
      return [
        {
          photo: p1,
          index: 0,
          leftPercent: 2,
          topPercent: 4,
          widthPercent: itemWidth,
          heightPercent: 92,
          fit: p1.fit || 'cover',
          objectPosition: p1.position || 'center',
          isPortrait: true,
          aspectRatio: getPhotoAspectRatio(p1),
        },
        {
          photo: p2,
          index: 1,
          leftPercent: 2 + itemWidth + GAP_X,
          topPercent: 4,
          widthPercent: itemWidth,
          heightPercent: 92,
          fit: p2.fit || 'cover',
          objectPosition: p2.position || 'center',
          isPortrait: true,
          aspectRatio: getPhotoAspectRatio(p2),
        },
      ];
    }

    // Default & side-by-side & auto: 2 equal columns (50/50)
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

  // ==========================================
  // 3 PHOTOS
  // ==========================================
  if (count === 3) {
    const [p1, p2, p3] = photos;

    if (preset === 'side-by-side') {
      // 3 Equal vertical columns
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

    if (preset === 'stacked') {
      // 3 Equal horizontal rows
      const rowHeight = (100 - GAP_Y * 2) / 3;
      return photos.map((p, idx) => ({
        photo: p,
        index: idx,
        leftPercent: 0,
        topPercent: idx * (rowHeight + GAP_Y),
        widthPercent: 100,
        heightPercent: rowHeight,
        fit: p.fit || 'cover',
        objectPosition: p.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p),
      }));
    }

    if (preset === 'grid') {
      // 1 Top Hero full width (50% H) + 2 Bottom Columns (47.5% H)
      const topHeight = 50;
      const btmHeight = 100 - topHeight - GAP_Y;
      const btmWidth = (100 - GAP_X) / 2;
      return [
        {
          photo: p1,
          index: 0,
          leftPercent: 0,
          topPercent: 0,
          widthPercent: 100,
          heightPercent: topHeight,
          fit: p1.fit || 'cover',
          objectPosition: p1.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p1),
        },
        {
          photo: p2,
          index: 1,
          leftPercent: 0,
          topPercent: topHeight + GAP_Y,
          widthPercent: btmWidth,
          heightPercent: btmHeight,
          fit: p2.fit || 'cover',
          objectPosition: p2.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p2),
        },
        {
          photo: p3,
          index: 2,
          leftPercent: btmWidth + GAP_X,
          topPercent: topHeight + GAP_Y,
          widthPercent: btmWidth,
          heightPercent: btmHeight,
          fit: p3.fit || 'cover',
          objectPosition: p3.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p3),
        },
      ];
    }

    // Default & editorial & auto: 1 Hero left (58%) + 2 stacked right (40%)
    const heroWidth = 58;
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

  // ==========================================
  // 4 PHOTOS
  // ==========================================
  if (count === 4) {
    const [p1, p2, p3, p4] = photos;

    if (preset === 'editorial') {
      // 1 Large Hero on left (60%) + 3 Stacked in right column (38%)
      const heroWidth = 60;
      const colWidth = 100 - heroWidth - GAP_X;
      const itemHeight = (100 - GAP_Y * 2) / 3;

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
          widthPercent: colWidth,
          heightPercent: itemHeight,
          fit: p2.fit || 'cover',
          objectPosition: p2.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p2),
        },
        {
          photo: p3,
          index: 2,
          leftPercent: heroWidth + GAP_X,
          topPercent: itemHeight + GAP_Y,
          widthPercent: colWidth,
          heightPercent: itemHeight,
          fit: p3.fit || 'cover',
          objectPosition: p3.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p3),
        },
        {
          photo: p4,
          index: 3,
          leftPercent: heroWidth + GAP_X,
          topPercent: (itemHeight + GAP_Y) * 2,
          widthPercent: colWidth,
          heightPercent: itemHeight,
          fit: p4.fit || 'cover',
          objectPosition: p4.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p4),
        },
      ];
    }

    if (preset === 'side-by-side') {
      // 4 Equal vertical columns
      const colWidth = (100 - GAP_X * 3) / 4;
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

    if (preset === 'stacked') {
      // 4 Equal horizontal strips
      const rowHeight = (100 - GAP_Y * 3) / 4;
      return photos.map((p, idx) => ({
        photo: p,
        index: idx,
        leftPercent: 0,
        topPercent: idx * (rowHeight + GAP_Y),
        widthPercent: 100,
        heightPercent: rowHeight,
        fit: p.fit || 'cover',
        objectPosition: p.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p),
      }));
    }

    // Default & grid & auto: 2x2 Balanced Matrix
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

  // ==========================================
  // 5 PHOTOS
  // ==========================================
  if (count === 5) {
    if (preset === 'editorial') {
      // 1 Large Hero on left (56%) + 4 Photos in 2x2 grid on right (42%)
      const heroWidth = 56;
      const rightTotalW = 100 - heroWidth - GAP_X;
      const rightColW = (rightTotalW - GAP_X) / 2;
      const rightRowH = (100 - GAP_Y) / 2;

      return photos.map((p, idx) => {
        if (idx === 0) {
          return {
            photo: p,
            index: 0,
            leftPercent: 0,
            topPercent: 0,
            widthPercent: heroWidth,
            heightPercent: 100,
            fit: p.fit || 'cover',
            objectPosition: p.position || 'center',
            isPortrait: false,
            aspectRatio: getPhotoAspectRatio(p),
          };
        }
        const rightIdx = idx - 1;
        const col = rightIdx % 2;
        const row = Math.floor(rightIdx / 2);
        return {
          photo: p,
          index: idx,
          leftPercent: heroWidth + GAP_X + col * (rightColW + GAP_X),
          topPercent: row * (rightRowH + GAP_Y),
          widthPercent: rightColW,
          heightPercent: rightRowH,
          fit: p.fit || 'cover',
          objectPosition: p.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p),
        };
      });
    }

    if (preset === 'grid' || preset === 'stacked') {
      // Top row 3 photos (32% each) + Bottom row 2 photos (49% each)
      const rowHeight = (100 - GAP_Y) / 2;
      const topColWidth = (100 - GAP_X * 2) / 3;
      const btmColWidth = (100 - GAP_X) / 2;

      return photos.map((p, idx) => {
        if (idx < 3) {
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
        }
        const btmIdx = idx - 3;
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
      });
    }

    // Default & auto & mosaic: Top row 2 photos + Bottom row 3 photos
    const rowHeight = (100 - GAP_Y) / 2;
    const topColWidth = (100 - GAP_X) / 2;
    const btmColWidth = (100 - GAP_X * 2) / 3;

    return photos.map((p, idx) => {
      if (idx < 2) {
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
      }
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
    });
  }

  // ==========================================
  // 6+ PHOTOS
  // ==========================================
  if (preset === 'editorial') {
    // 1 Major Hero on left (50%) + remaining in 2 columns on right
    const heroWidth = 50;
    const rightTotalW = 100 - heroWidth - GAP_X;
    const rightColW = (rightTotalW - GAP_X) / 2;
    const remainingCount = Math.min(count - 1, 5);
    const rightRows = Math.ceil(remainingCount / 2);
    const rightRowH = (100 - GAP_Y * (rightRows - 1)) / rightRows;

    return photos.slice(0, 6).map((p, idx) => {
      if (idx === 0) {
        return {
          photo: p,
          index: 0,
          leftPercent: 0,
          topPercent: 0,
          widthPercent: heroWidth,
          heightPercent: 100,
          fit: p.fit || 'cover',
          objectPosition: p.position || 'center',
          isPortrait: false,
          aspectRatio: getPhotoAspectRatio(p),
        };
      }
      const rIdx = idx - 1;
      const col = rIdx % 2;
      const row = Math.floor(rIdx / 2);
      return {
        photo: p,
        index: idx,
        leftPercent: heroWidth + GAP_X + col * (rightColW + GAP_X),
        topPercent: row * (rightRowH + GAP_Y),
        widthPercent: rightColW,
        heightPercent: rightRowH,
        fit: p.fit || 'cover',
        objectPosition: p.position || 'center',
        isPortrait: false,
        aspectRatio: getPhotoAspectRatio(p),
      };
    });
  }

  if (preset === 'stacked') {
    // 2 Columns x 3 Rows
    const cols = 2;
    const rows = 3;
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

  // Default & grid & auto: 3 Columns x 2 Rows
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
