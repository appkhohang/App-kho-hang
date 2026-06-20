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
  // Save original styleSheets descriptor to restore later
  const styleSheetsDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets') ||
                                Object.getOwnPropertyDescriptor(document, 'styleSheets');
                                
  // Save original getComputedStyle
  const originalGetComputedStyle = window.getComputedStyle;

  try {
    // 1. Redefine document.styleSheets
    Object.defineProperty(document, 'styleSheets', {
      get: () => {
        // Return a mock StyleSheetList-like object that returns 0 sheets.
        // This causes html2canvas to skip global stylesheet rules parsing (which parses raw text and fails on modern colors),
        // while it still correctly resolves inline styles and class-computed styles via getComputedStyle!
        const mockList = {
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {}
        };
        return mockList as unknown as StyleSheetList;
      },
      configurable: true
    });
  } catch (err) {
    console.warn("Could not temporarily redefine document.styleSheets for safe html2canvas capture:", err);
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
    // 3. Restore original styleSheets property to prevent side effects
    if (styleSheetsDescriptor) {
      Object.defineProperty(document, 'styleSheets', styleSheetsDescriptor);
    } else {
      try {
        delete (document as any).styleSheets;
      } catch (e) {
        // Ignore if delete fails
      }
    }

    // 4. Restore original getComputedStyle
    window.getComputedStyle = originalGetComputedStyle;
  }
}
