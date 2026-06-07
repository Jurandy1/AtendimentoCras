import React from "react";
import { cn } from "./cn";

const styles = {
  primary:
    "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover shadow-soft",
  secondary:
    "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 shadow-soft",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-soft",
  custom: "shadow-soft transition-colors",
};

const sizes = {
  sm: "text-sm px-3 py-2 rounded-lg",
  md: "text-sm px-4 py-2.5 rounded-lg",
  lg: "text-base px-5 py-3 rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  type = "button",
  isLoading,
  loading,
  ...props
}) {
  const loadingFinal = typeof isLoading === "boolean" ? isLoading : !!loading;
  return (
    <button
      type={type}
      disabled={disabled || loadingFinal}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        sizes[size] || sizes.md,
        styles[variant] || styles.primary,
        className
      )}
      {...props}
    />
  );
}
