import React from "react";
import { cn } from "./cn";

export default function Input({ className, label, error, endContent, ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={cn(
            "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition disabled:bg-slate-50 disabled:text-slate-500 placeholder:text-slate-400",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            endContent && "pr-10",
            className
          )}
          {...props}
        />
        {endContent && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
            {endContent}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
