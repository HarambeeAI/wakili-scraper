"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "btn-primary text-white",
      secondary: "bg-white text-dark border border-border hover:bg-light",
      ghost: "text-muted-dark hover:text-dark hover:bg-light",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
