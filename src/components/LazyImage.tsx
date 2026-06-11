import React, { useState, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export function LazyImage({ src, alt, className, style, ...props }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');

  useEffect(() => {
    setIsLoaded(false);
    if (src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setIsLoaded(true);
        setCurrentSrc(src);
      };
      img.onerror = () => {
        setIsLoaded(true); // Stop loading if error occurs to show broken image gracefully
        setCurrentSrc(src);
      };
    }
  }, [src]);

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-slate-100/30 dark:bg-zinc-950/20">
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200/45 dark:bg-zinc-800/40 animate-pulse flex items-center justify-center z-10">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      <img
        src={currentSrc || src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`transition-all duration-500 ease-out ${
          isLoaded ? 'blur-none opacity-100 scale-100' : 'blur-md opacity-40 scale-[0.98]'
        } ${className || ''}`}
        style={style}
        {...props}
      />
    </div>
  );
}
