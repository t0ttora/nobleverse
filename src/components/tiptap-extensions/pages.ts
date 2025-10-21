import { Extension } from '@tiptap/core';

// Utilities and types for page formats
export type PageMarginsPx = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type PageFormat = {
  id: string;
  width: number;
  height: number;
  margins: PageMarginsPx;
};

const CM_TO_PX = 96 / 2.54;
export function cmToPixels(cm: number) {
  return Math.round(cm * CM_TO_PX);
}

export const PAGE_FORMATS: Record<string, PageFormat> = {
  A4: {
    id: 'A4',
    width: 794,
    height: 1123,
    margins: {
      top: cmToPixels(2.5),
      right: cmToPixels(2.0),
      bottom: cmToPixels(2.5),
      left: cmToPixels(2.0)
    }
  },
  A3: {
    id: 'A3',
    width: 1123,
    height: 1587,
    margins: {
      top: cmToPixels(2.5),
      right: cmToPixels(2.0),
      bottom: cmToPixels(2.5),
      left: cmToPixels(2.0)
    }
  },
  A5: {
    id: 'A5',
    width: 559,
    height: 794,
    margins: {
      top: cmToPixels(2.0),
      right: cmToPixels(1.5),
      bottom: cmToPixels(2.0),
      left: cmToPixels(1.5)
    }
  },
  Letter: {
    id: 'Letter',
    width: 816,
    height: 1063,
    margins: {
      top: cmToPixels(2.54),
      right: cmToPixels(2.54),
      bottom: cmToPixels(2.54),
      left: cmToPixels(2.54)
    }
  },
  Legal: {
    id: 'Legal',
    width: 816,
    height: 1346,
    margins: {
      top: cmToPixels(2.54),
      right: cmToPixels(2.54),
      bottom: cmToPixels(2.54),
      left: cmToPixels(2.54)
    }
  },
  Tabloid: {
    id: 'Tabloid',
    width: 1063,
    height: 1634,
    margins: {
      top: cmToPixels(2.54),
      right: cmToPixels(2.54),
      bottom: cmToPixels(2.54),
      left: cmToPixels(2.54)
    }
  }
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pages: {
      /** Set the current page format (by id of built-in or a custom format object). */
      setPageFormat: (format: string | PageFormat) => ReturnType;
    };
  }
}

export interface PagesOptions {
  /** Initial page format; string refers to PAGE_FORMATS key. */
  pageFormat?: string | PageFormat;
  /** Listener for page format changes. */
  onPageFormatChange?: (format: PageFormat) => void;
}

export interface PagesStorage {
  pageFormat: PageFormat;
}

function resolveFormat(format?: string | PageFormat): PageFormat {
  if (!format) return PAGE_FORMATS.A4;
  if (typeof format === 'string')
    return PAGE_FORMATS[format] || PAGE_FORMATS.A4;
  return format;
}

const PagesExt = Extension.create<PagesOptions, PagesStorage>({
  name: 'pages',

  addOptions() {
    return {
      pageFormat: 'A4',
      onPageFormatChange: undefined
    } satisfies PagesOptions;
  },

  addStorage() {
    return {
      pageFormat: resolveFormat(this.options.pageFormat)
    } as PagesStorage;
  },

  addCommands() {
    return {
      setPageFormat:
        (format: string | PageFormat) =>
        ({ editor }) => {
          const next = resolveFormat(format);
          (this.storage as PagesStorage).pageFormat = next;
          // Fire callback if provided
          this.options.onPageFormatChange?.(next);
          // Emit a custom editor event for consumers (typed as any to avoid EditorEvents narrowing)
          (editor as any)?.emit?.('pages:formatChanged', next);
          return true;
        }
    };
  }
});

// Cast to any to avoid cross-module Tiptap type narrowing issues in some setups
export const Pages: any = PagesExt as any;
export default Pages;
