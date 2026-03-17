'use client';

import { clsx } from 'clsx';
import React from 'react';

export function Box({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('bg-[#111] border border-[#222] rounded-lg p-4', className)}>
      {children}
    </div>
  );
}

export function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={clsx(
        'block text-xs text-[#666] mb-1 font-mono uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </label>
  );
}

export function DisplayValue({
  value,
  color,
  className,
}: {
  value: string | number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx('font-mono text-sm', className)}
      style={{ color: color ?? '#ccc' }}
    >
      {value}
    </span>
  );
}

export function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={clsx(
        'w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm font-mono text-[#ccc]',
        'focus:outline-none focus:border-[#c8f135] transition-colors',
        className,
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm font-mono text-[#ccc]',
        'focus:outline-none focus:border-[#c8f135] transition-colors cursor-pointer',
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function RangeSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  displayValue,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  displayValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <FieldLabel>{label}</FieldLabel>
          <span className="text-xs font-mono text-[#c8f135]">
            {displayValue ?? value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer h-1 rounded appearance-none bg-[#333] accent-[#c8f135]"
      />
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className,
  size = 'md',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const base =
    'font-mono rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-[#c8f135] text-black hover:bg-[#d4f55a] font-bold',
    secondary:
      'bg-[#1a1a1a] border border-[#333] text-[#ccc] hover:border-[#c8f135] hover:text-[#c8f135]',
    danger:
      'bg-transparent border border-[#ff5252] text-[#ff5252] hover:bg-[#ff5252] hover:text-black',
    ghost: 'bg-transparent text-[#888] hover:text-[#ccc]',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  const c = color ?? '#c8f135';
  return (
    <span
      className={clsx('inline-block px-2 py-0.5 rounded text-xs font-mono font-bold', className)}
      style={{
        backgroundColor: `${c}22`,
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {children}
    </span>
  );
}

export function SegmentedControl({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex bg-[#111] border border-[#333] rounded overflow-hidden',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'flex-1 px-3 py-2 text-xs font-mono transition-all cursor-pointer',
            value === opt.value
              ? 'bg-[#c8f135] text-black font-bold'
              : 'text-[#888] hover:text-[#ccc]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
