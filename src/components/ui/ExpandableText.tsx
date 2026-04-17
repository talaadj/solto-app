import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const ExpandableText = ({ text, className = "", limit = 100 }: { text: string, className?: string, limit?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > limit;

  if (!shouldTruncate) return <p className={className}>{text}</p>;

  return (
    <div className={className}>
      <div className={isExpanded ? "" : "line-clamp-2"}>
        {text}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        className="text-[10px] font-bold text-indigo-600 hover:underline mt-1 flex items-center gap-1"
      >
        {isExpanded ? "Скрыть" : "Подробнее..."}
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
    </div>
  );
};
