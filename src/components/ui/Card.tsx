import React from 'react';

export const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, id?: string | number, key?: React.Key, onClick?: () => void }) => (
  <div onClick={onClick} className={`bg-white border border-black/5 rounded-2xl shadow-sm p-6 ${className}`}>
    {children}
  </div>
);
