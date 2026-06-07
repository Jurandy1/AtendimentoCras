import React from "react";
import { cn } from "./cn";

export default function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "bg-white border border-govbr-borda rounded-xl shadow-soft",
        className
      )}
      {...props}
    />
  );
}
