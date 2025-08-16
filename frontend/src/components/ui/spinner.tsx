"use client";

import React from "react";

type SpinnerProps = {
  className?: string;
  size?: number; // px
  colorClass?: string; // tailwind text-*
};

export default function Spinner({ className = "", size = 20, colorClass = "text-white" }: SpinnerProps) {
  const stroke = "currentColor";
  const box = size;
  return (
    <svg
      className={`animate-spin ${colorClass} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox={`0 0 24 24`}
      width={box}
      height={box}
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={stroke} strokeWidth="4" />
      <path className="opacity-75" fill={stroke} d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
