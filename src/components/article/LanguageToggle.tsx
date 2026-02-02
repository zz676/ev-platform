"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  onLanguageChange: (lang: "en" | "zh") => void;
  defaultLanguage?: "en" | "zh";
}

export function LanguageToggle({
  onLanguageChange,
  defaultLanguage = "en",
}: LanguageToggleProps) {
  const [language, setLanguage] = useState<"en" | "zh">(defaultLanguage);

  useEffect(() => {
    // Check localStorage for preference
    const saved = localStorage.getItem("articleLanguage") as "en" | "zh" | null;
    if (saved) {
      setLanguage(saved);
      onLanguageChange(saved);
    }
  }, [onLanguageChange]);

  const handleToggle = (lang: "en" | "zh") => {
    setLanguage(lang);
    localStorage.setItem("articleLanguage", lang);
    onLanguageChange(lang);
  };

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
      <button
        onClick={() => handleToggle("en")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
          language === "en"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        EN
      </button>
      <button
        onClick={() => handleToggle("zh")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
          language === "zh"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        中文
      </button>
    </div>
  );
}
