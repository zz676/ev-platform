"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-24 right-6 z-50 group"
      aria-label="Back to top"
    >
      {/* Outer glowing ring */}
      <span className="absolute inset-[-4px] rounded-full bg-lime-400/30 blur-md animate-glow-pulse" />

      {/* Middle glowing ring */}
      <span className="absolute inset-[-2px] rounded-full bg-lime-400/50 blur-sm animate-pulse" />

      {/* Button */}
      <span className="relative flex items-center justify-center w-11 h-11 bg-white rounded-full border-2 border-lime-400 shadow-lg transition-all duration-300 group-hover:border-lime-500 group-hover:shadow-[0_0_25px_rgba(163,230,53,0.7)]">
        <ArrowUp className="h-5 w-5 text-lime-600 transition-all duration-300 group-hover:text-lime-700 group-hover:-translate-y-0.5" />
      </span>
    </button>
  );
}
