import React from 'react';
import { cn } from './cn';

export default function Section({ title, description, children, className }) {
  return (
    <div className={cn("bg-slate-50/50 p-4 rounded-lg border border-slate-100", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold text-slate-800">{title}</h3>}
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        {children}
      </div>
    </div>
  );
}
