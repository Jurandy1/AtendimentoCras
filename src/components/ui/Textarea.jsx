import React from "react";
import { cn } from "./cn";

export default function Textarea({ className, rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition disabled:bg-gray-100 disabled:text-gray-600 leading-relaxed",
        className
      )}
      {...props}
    />
  );
}
