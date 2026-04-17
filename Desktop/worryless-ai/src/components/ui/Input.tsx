"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-dark mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-dark placeholder:text-muted outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${
            error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
