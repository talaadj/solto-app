import React from 'react';

export const Badge = ({ children, color }: { children: React.ReactNode, color: string }) => (
  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
    {children}
  </span>
);
