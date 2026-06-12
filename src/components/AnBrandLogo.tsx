/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AnBrandLogoProps {
  className?: string;
  size?: number; // Overrides width/height if provided
  width?: number;
  height?: number;
  showText?: boolean;
}

export default function AnBrandLogo({
  className = '',
  size = 180,
  width,
  height,
  showText = true,
}: AnBrandLogoProps) {
  const w = width || size;
  const h = height || size;

  return (
    <div className={`flex flex-col items-center justify-center font-sans ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full select-none"
      >
        {/* Definition of gradients and shadows if needed */}
        <defs>
          <style>
            {`
              @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Montserrat:wght@400;700&display=swap');
              .brand-serif { font-family: 'Playfair Display', Georgia, serif; }
              .brand-sans { font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; }
            `}
          </style>
          
          <linearGradient id="brandGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#c59f3f" />
            <stop offset="100%" stopColor="#aa821f" />
          </linearGradient>
          
          <linearGradient id="brandNavyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3c72" />
            <stop offset="100%" stopColor="#0f2042" />
          </linearGradient>
        </defs>

        {/* 1. Left/Outer Circular Arc Sweep (Deep Navy) */}
        <path
          d="M340 75 C 150 50, 50 170, 75 300 C 95 385, 200 450, 310 440 C 315 440, 345 435, 310 438 C 215 440, 105 380, 85 285 C 65 190, 150 95, 340 100"
          fill="none"
          stroke="#0f294a"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* 2. Top/Inner Delicate Accent Crescent (Gold) */}
        <path
          d="M100 200 C 130 90, 260 70, 360 120"
          fill="none"
          stroke="url(#brandGoldGradient)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* 3. Bottom Outer Golden Grounding Arc */}
        <path
          d="M152 380 C 205 445, 330 445, 410 320"
          fill="none"
          stroke="url(#brandGoldGradient)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* 4. Elegant Dashed Stitch Line at the Bottom of 'An' */}
        <path
          d="M236 312 C 275 340, 365 330, 422 284"
          fill="none"
          stroke="#0f294a"
          strokeWidth="2.8"
          strokeDasharray="7,7"
          strokeLinecap="round"
        />

        {/* 5. Sewing Machine Vector Illustration (Navy) */}
        <g transform="translate(15, -4)">
          {/* Base Plate of the sewing machine */}
          <path
            d="M234 220 L 368 220 L 368 223 L 234 223 Z"
            fill="#0f294a"
          />
          {/* Main Arm and column assembly of the machine */}
          <path
            d="M315 220 C 315 220, 312 110, 318 110 C 322 110, 350 110, 350 135 C 350 160, 340 220, 340 220 L 358 220 L 350 125 C 345 102, 315 95, 290 105 C 275 110, 245 112, 238 126 C 235 132, 235 200, 235 200"
            fill="none"
            stroke="#0f294a"
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M238 135 L 246 135 L 246 200 L 238 200 Z"
            fill="#0f294a"
          />
          {/* Vertical Needle bar block */}
          <line x1="242" y1="195" x2="242" y2="214" stroke="#0f294a" strokeWidth="3" strokeLinecap="round" />
          {/* Spool holder pin */}
          <line x1="334" y1="92" x2="334" y2="104" stroke="#0f294a" strokeWidth="2.5" />
          {/* Spindle wheel on right */}
          <rect x="358" y="115" width="5.5" height="42" rx="2.5" fill="#0f294a" />
          <circle cx="360.5" cy="136" r="8" fill="#0f294a" />
          {/* Small silver lifter knob */}
          <circle cx="242" cy="110" r="4.5" fill="url(#brandGoldGradient)" />
        </g>

        {/* 6. Spool of Gold Thread (Gold spool, Navy capped boundaries) */}
        <g transform="translate(13, -1)">
          {/* Thread body spool bounds */}
          <rect x="358" y="196" width="41" height="48" rx="2" fill="url(#brandGoldGradient)" />
          {/* Spool horizontal thread lines effect */}
          <line x1="359" y1="202" x2="398" y2="202" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="208" x2="398" y2="208" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="214" x2="398" y2="214" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="220" x2="398" y2="220" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="226" x2="398" y2="226" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="232" x2="398" y2="232" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          <line x1="359" y1="238" x2="398" y2="238" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
          {/* Spool bounds capping (Navy discs at base and top) */}
          <ellipse cx="378.5" cy="196" rx="21.5" ry="6.5" fill="#0f294a" />
          <ellipse cx="378.5" cy="244" rx="21.5" ry="6.5" fill="#0f294a" />
          {/* Golden thread line winding from top needle down around */}
          <path
            d="M257 106 C 220 100, 195 130, 218 160 C 235 180, 255 170, 230 140"
            fill="none"
            stroke="url(#brandGoldGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Loose thread trailing from spool right side */}
          <path
            d="M400 230 C 428 230, 440 250, 410 262 C 392 270, 360 270, 330 290"
            fill="none"
            stroke="url(#brandGoldGradient)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* 7. Golden letter "A" & Navy "n" (representing "An") */}
        {/* We place elegant vector typography for "A" with sweeping swashes */}
        {/* Draw the "A" with detailed paths to match the serif flourish */}
        <path
          d="M176 300 C 172 300, 150 295, 128 275 C 102 250, 110 216, 126 195 C 145 170, 178 171, 185 198 C 190 215, 172 232, 160 242 M160 242 C 160 242, 238 290, 280 295 C 310 298, 350 280, 362 255"
          fill="none"
          stroke="url(#brandGoldGradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* The elegant main Letter "A" (Navy Blue with beautiful serifs) */}
        <text
          x="195"
          y="300"
          className="brand-serif"
          fontSize="175"
          fill="#0f294a"
          fontWeight="700"
          letterSpacing="-0.05em"
        >
          A
        </text>

        {/* The elegant Letter "n" nestled next to "A" and below the sewing machine */}
        <text
          x="281"
          y="300"
          className="brand-serif"
          fontSize="135"
          fill="#0f294a"
          fontWeight="700"
        >
          n
        </text>

        {/* 8. Text banner: " — XƯỞNG MAY — " */}
        {showText && (
          <g>
            {/* Horizontal line details with gold accent diamonds */}
            <line x1="135" y1="350" x2="160" y2="350" stroke="url(#brandGoldGradient)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="340" y1="350" x2="365" y2="350" stroke="url(#brandGoldGradient)" strokeWidth="2.5" strokeLinecap="round" />
            
            <text
              x="250"
              y="356"
              className="brand-sans"
              fontSize="24"
              fill="#0f294a"
              letterSpacing="0.28em"
              textAnchor="middle"
              fontWeight="900"
            >
              XƯỞNG MAY
            </text>

            {/* Bottom fine golden divider rail */}
            <line x1="184" y1="375" x2="316" y2="375" stroke="url(#brandGoldGradient)" strokeWidth="1.5" />
            {/* Center diamond icon */}
            <path
              d="M250 370 L 255 375 L 250 380 L 245 375 Z"
              fill="url(#brandGoldGradient)"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
