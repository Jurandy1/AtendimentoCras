import React from "react";
import { cn } from "./cn";

const variants = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-green-50 border-green-200 text-green-700",
};

export default function InlineAlert({ variant = "info", className, ...props }) {
  return (
    <div
      className={cn(
        "px-4 py-3 border rounded-lg text-sm",
        variants[variant] || variants.info,
        className
      )}
      {...props}
    />
  );
}
