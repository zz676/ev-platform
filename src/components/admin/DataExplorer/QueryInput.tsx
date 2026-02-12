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
    <div className="space-y-3">
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about EV industry data... (e.g., 'BYD deliveries in 2024')"
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-none text-sm"
          rows={2}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-ev-green-500 text-white text-sm font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ev-green-500 animate-pulse" />
          Generating query (LLM). This can take a few seconds.
        </div>
      )}

      {/* Suggestions Toggle */}
      {suggestedQuestions && Object.keys(suggestedQuestions).length > 0 && (
        <div>
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showSuggestions ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Example Questions
          </button>

          {showSuggestions && (
            <div className="mt-2 border border-ev-green-200 rounded-lg bg-ev-green-50 p-3">
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
                        className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900 w-full text-left"
                      >
                        {expandedCategory === category ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {category}
                      </button>
                      {expandedCategory === category && (
                        <ul className="mt-1 space-y-1">
                          {questions.map((q, i) => (
                            <li key={i}>
                              <button
                                onClick={() => handleSuggestionClick(q)}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left w-full truncate"
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
