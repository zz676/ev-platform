"use client";

import { useState } from "react";
import {
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface SuggestedQuestions {
  [category: string]: string[];
}

interface QueryInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  suggestedQuestions?: SuggestedQuestions;
}

export function QueryInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  suggestedQuestions,
}: QueryInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSuggestionClick = (question: string) => {
    onChange(question);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3 text-slate-900">
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about EV industry data... (e.g., 'BYD deliveries in 2024')"
          className="h-12 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-36 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
          rows={1}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className="absolute inset-y-0 right-2 my-auto inline-flex h-fit items-center gap-1.5 rounded-lg bg-lime-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate
            </>
          )}
        </button>
      </div>

      {isLoading && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse" />
          Generating query (LLM). This can take a few seconds.
        </div>
      )}

      {/* Suggestions Toggle */}
      {suggestedQuestions && Object.keys(suggestedQuestions).length > 0 && (
        <div>
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
          >
            {showSuggestions ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Example Questions
          </button>

          {showSuggestions && (
            <div className="mt-2 rounded-xl border border-lime-200 bg-lime-100/35 p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(suggestedQuestions).map(
                  ([category, questions]) => (
                    <div key={category}>
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === category ? null : category
                          )
                        }
                        className="flex w-full items-center gap-1 text-left font-mono text-sm font-medium text-slate-900 hover:text-slate-900"
                      >
                        {expandedCategory === category ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {category}
                      </button>
                      {expandedCategory === category && (
                        <ul className="mt-1 space-y-0 pl-4">
                          {questions.map((q, i) => (
                            <li key={i} className="pt-0">
                              <button
                                onClick={() => handleSuggestionClick(q)}
                                className="w-full truncate pt-0 text-left font-mono text-[12px] text-slate-900 hover:text-slate-900 hover:underline"
                                title={q}
                              >
                                {q}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
