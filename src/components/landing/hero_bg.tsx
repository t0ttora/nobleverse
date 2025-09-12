import React from 'react';

// Animated gradient bars used as a visual background effect
const GradientBars: React.FC = () => {
  const numBars = 15;

  const calculateHeight = (index: number, total: number) => {
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;

    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);

    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black'>
      <div
        className='flex h-full'
        style={{
          width: '100%',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased'
        }}
      >
        {Array.from({ length: numBars }).map((_, index) => {
          const height = calculateHeight(index, numBars);
          return (
            <div
              key={index}
              className='gradient-bar'
              style={{
                flex: '1 0 calc(100% / 15)',
                maxWidth: 'calc(100% / 15)',
                height: '100%',
                background:
                  'linear-gradient(to top, rgb(255, 60, 0), transparent)',
                transform: `scaleY(${height / 100})`,
                transformOrigin: 'bottom',
                transition: 'transform 0.5s ease-in-out',
                animationDelay: `${index * 0.1}s`,
                outline: '1px solid rgba(0, 0, 0, 0)',
                boxSizing: 'border-box'
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
// Background-only component with theme-aware base and animated gradient bars
interface BgProps {
  // 'background' follows theme tokens; 'light' forces white; 'dark' forces dark.
  base?: 'background' | 'light' | 'dark';
}

export const Component: React.FC<BgProps> = ({ base = 'background' }) => {
  const baseClass =
    base === 'light'
      ? 'bg-white'
      : base === 'dark'
        ? 'bg-gray-950'
        : 'bg-background';
  return (
    <div className='pointer-events-none absolute inset-0 overflow-hidden'>
      <div className={`absolute inset-0 ${baseClass}`} />
      <GradientBars />
    </div>
  );
};
