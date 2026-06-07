import React from "react";
import { cn } from "./cn";

export function Field({ label, hint, error, className, children }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex items-end justify-between gap-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {label}
          </label>
          {hint && <div className="text-xs text-gray-400">{hint}</div>}
        </div>
      )}
      {children}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
