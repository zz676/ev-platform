"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 400px
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
      className="fixed bottom-8 left-6 z-50 flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider text-gray-600 bg-white rounded-full border-2 border-lime-400 shadow-lg transition-all duration-300 hover:border-lime-500 hover:text-gray-800 hover:shadow-[0_0_12px_rgba(163,230,53,0.5)] before:absolute before:inset-0 before:rounded-full before:border-2 before:border-lime-400 before:animate-pulse before:opacity-40"
      aria-label="Back to top"
    >
      <ChevronUp className="h-4 w-4" />
      TOP
    </button>
  );
}
