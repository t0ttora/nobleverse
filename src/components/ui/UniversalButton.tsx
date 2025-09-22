import React from 'react';

interface UniversalButtonProps {
  text?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const UniversalButton: React.FC<UniversalButtonProps> = ({
  text,
  icon,
  onClick,
  className,
  disabled
}) => (
  <button
    className={`bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded px-4 py-2 font-medium shadow transition ${className ?? ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    onClick={onClick}
    type='button'
    disabled={disabled}
  >
    {icon && <span>{icon}</span>}
    {text && <span>{text}</span>}
  </button>
);
