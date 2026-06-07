import React from "react";
import { cn } from "./cn";

const variants = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  green: "bg-green-50 text-green-700 border-green-200",
  yellow: "bg-yellow-50 text-yellow-800 border-yellow-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  red: "bg-red-50 text-red-700 border-red-200",
};

export default function Badge({ variant = "gray", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-full",
        variants[variant] || variants.gray,
        className
      )}
      {...props}
    />
  );
}
