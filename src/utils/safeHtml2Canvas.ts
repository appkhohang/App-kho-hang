import html2canvas from 'html2canvas';

// In-memory cache to skip heavy style calculations and avoid WebGL/Canvas allocation leaks
const colorCache = new Map<string, string>();

/**
 * Converts any modern color string (oklch, oklab, hwb) into standard rgba color format using browser canvas rendering.
 */
function modernColorToRgbWithCanvas(colorStr: string): string {
  if (colorCache.has(colorStr)) {
    return colorCache.get(colorStr)!;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return colorStr;
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const imgData = ctx.getImageData(0, 0, 1, 1).data;
    // imgData is [r, g, b, a] where a is 0-255
    const alpha = (imgData[3] / 255).toFixed(3);
    const result = `rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${alpha})`;
    colorCache.set(colorStr, result);
    return result;
  } catch (e) {
    console.warn("modernColorToRgbWithCanvas failed for:", colorStr, e);
    return colorStr;
  }
}

/**
 * Replaces modern CSS color occurrences in a CSS string with parsed standard rgba(...) format.
 */
function translateModernColorValues(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }
  if (!str.includes('oklch') && !str.includes('oklab') && !str.includes('hwb')) {
    return str;
  }
  // Matches oklch(...), oklab(...), and hwb(...) colors
  const colorRegex = /(oklch|oklab|hwb)\([^)]+\)/g;
  return str.replace(colorRegex, (match) => {
    return modernColorToRgbWithCanvas(match);
  });
}

function hasModernColors(value: any): boolean {
  return typeof value === 'string' && (value.includes('oklch') || value.includes('oklab') || value.includes('hwb'));
}

const COLOR_PROPS_SUBSTRINGS = ['color', 'fill', 'stroke'];
function isColorProperty(propName: string): boolean {
  const lower = propName.toLowerCase();
  return COLOR_PROPS_SUBSTRINGS.some(sub => lower.includes(sub));
}

/**
 * A safe wrapper around html2canvas that temporarily overrides document.styleSheets
 * and window.getComputedStyle to prevent crashes caused by newer CSS color functions
 * (like "oklch" or "oklab" in Tailwind v4) during style parsing.
 */
export async function safeHtml2Canvas(element: HTMLElement, options?: any): Promise<HTMLCanvasElement> {
  const protoDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');
  const docOwnDescriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
  const originalGetComputedStyle = window.getComputedStyle;

  try {
    if (protoDescriptor) {
      Object.defineProperty(Document.prototype, 'styleSheets', {
        get() {
          const mockList = {
            length: 0,
            item: () => null,
            [Symbol.iterator]: function* () {}
          };
          return mockList as unknown as StyleSheetList;
        },
        configurable: true,
        enumerable: true
      });
    }
    
    // Also shadow on the document instance to make sure html2canvas gets it there too:
    Object.defineProperty(document, 'styleSheets', {
      get() {
        const mockList = {
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {}
        };
        return mockList as unknown as StyleSheetList;
      },
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("Could not temporarily redefine styleSheets descriptor:", err);
  }

  try {
    // 2. Wrap window.getComputedStyle with extremely fast-filtering proxy
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle.call(this, elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          if (typeof prop !== 'string') {
            return target[prop as any];
          }

          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const realVal = style.getPropertyValue(propertyName);
              if (isColorProperty(propertyName) && hasModernColors(realVal)) {
                return translateModernColorValues(realVal);
              }
              return realVal;
            };
          }

          const val = target[prop as any];
          if (typeof val === 'function') {
            return val.bind(target);
          }

          if (isColorProperty(prop) && hasModernColors(val)) {
            return translateModernColorValues(val);
          }

          return val;
        }
      });
    };
  } catch (err) {
    console.warn("Could not temporarily override window.getComputedStyle:", err);
  }

  try {
    const finalOptions = {
      logging: false,
      imageTimeout: 0,
      removeContainer: true,
      ...options,
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        const fixedWidth = options?.fixedLayoutWidth;
        if (fixedWidth) {
          try {
            clonedEl.style.width = `${fixedWidth}px`;
            clonedEl.style.minWidth = `${fixedWidth}px`;
            clonedEl.style.maxWidth = `${fixedWidth}px`;
            clonedEl.style.boxSizing = 'border-box';
            
            let parent = clonedEl.parentElement;
            while (parent) {
              parent.style.width = '100%';
              parent.style.maxWidth = 'none';
              parent.style.minWidth = 'none';
              parent.style.padding = '0';
              parent.style.margin = '0';
              parent = parent.parentElement;
            }
          } catch (layoutErr) {
            console.warn("Could not apply fixedLayoutWidth to cloned element:", layoutErr);
          }
        }

        try {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              font-family: "Inter", "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }
            
            .font-mono, 
            [class*="font-mono"],
            th.font-mono,
            td.font-mono,
            strong.font-mono {
              font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace !important;
            }

            table {
              table-layout: fixed !important;
              width: 100% !important;
              border-collapse: collapse !important;
            }

            td, th {
              line-height: 1.45 !important;
              vertical-align: middle !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        } catch (cssErr) {
          console.warn("Could not inject custom font styles into cloned document:", cssErr);
        }

        if (options && typeof options.onclone === 'function') {
          options.onclone(clonedDoc, clonedEl);
        }
      }
    };

    const canvas = await html2canvas(element, finalOptions);
    return canvas;
  } finally {
    // 3. Restore styleSheets property safely:
    try {
      if (protoDescriptor) {
        Object.defineProperty(Document.prototype, 'styleSheets', protoDescriptor);
      }
    } catch (e) {
      console.warn("Could not restore Document.prototype.styleSheets:", e);
    }

    try {
      if (docOwnDescriptor) {
        Object.defineProperty(document, 'styleSheets', docOwnDescriptor);
      } else {
        delete (document as any).styleSheets;
      }
    } catch (e) {
      console.warn("Could not restore document.styleSheets:", e);
    }

    // 4. Restore original getComputedStyle
    window.getComputedStyle = originalGetComputedStyle;
  }
}
