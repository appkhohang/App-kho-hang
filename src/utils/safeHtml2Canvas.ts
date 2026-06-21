import html2canvas from 'html2canvas';

/**
 * Converts any oklch color string into standard rgba color format using browser canvas rendering.
 */
function oklchToRgbWithCanvas(oklchColor: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return oklchColor;
    ctx.fillStyle = oklchColor;
    ctx.fillRect(0, 0, 1, 1);
    const imgData = ctx.getImageData(0, 0, 1, 1).data;
    // imgData is [r, g, b, a] where a is 0-255
    const alpha = (imgData[3] / 255).toFixed(3);
    return `rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${alpha})`;
  } catch (e) {
    console.warn("oklchToRgbWithCanvas failed for:", oklchColor, e);
    return oklchColor;
  }
}

/**
 * Replaces any oklch(...) occurrences in a CSS string with parsed standard rgba(...) format.
 */
function translateOklchValues(str: string): string {
  if (!str || typeof str !== 'string' || !str.includes('oklch')) {
    return str;
  }
  const oklchRegex = /oklch\([^)]+\)/g;
  return str.replace(oklchRegex, (match) => {
    return oklchToRgbWithCanvas(match);
  });
}

/**
 * A safe wrapper around html2canvas that temporarily overrides document.styleSheets
 * and window.getComputedStyle to prevent crashes caused by newer CSS color functions
 * (like "oklch" in Tailwind v4) during style parsing.
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
    // 2. Wrap window.getComputedStyle
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle.call(this, elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const val = Reflect.get(target, prop);
          
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const realVal = style.getPropertyValue(propertyName);
              if (typeof realVal === 'string' && realVal.includes('oklch')) {
                return translateOklchValues(realVal);
              }
              return realVal;
            };
          }
          
          if (typeof val === 'string' && val.includes('oklch')) {
            return translateOklchValues(val);
          }
          
          if (typeof val === 'function') {
            return val.bind(target);
          }
          
          return val;
        }
      });
    };
  } catch (err) {
    console.warn("Could not temporarily override window.getComputedStyle:", err);
  }

  try {
    const canvas = await html2canvas(element, options);
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
