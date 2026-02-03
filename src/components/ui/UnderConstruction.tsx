"use client";

import Link from "next/link";
import Image from "next/image";
import { Zap } from "lucide-react";

interface UnderConstructionProps {
  message: string;
  backText: string;
  locale: string;
}

export function UnderConstruction({ message, backText, locale }: UnderConstructionProps) {
  return (
    <div className="min-h-screen bg-lime-50 flex flex-col items-center justify-center px-4">
      {/* Animated charging icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-lime-100 flex items-center justify-center animate-pulse">
          <Image
            src="/icon-48.png"
            alt="EV Juice"
            width={48}
            height={48}
            className="w-12 h-12"
          />
        </div>
        {/* Lightning bolt animation */}
        <div className="absolute -top-2 -right-2 animate-bounce">
          <Zap className="w-8 h-8 text-ev-green-500 fill-ev-green-300" />
        </div>
      </div>

      {/* Message */}
      <h1 className="text-2xl md:text-3xl text-center mb-4" style={{ color: '#51bf24' }}>
        {message}
      </h1>

      {/* Charging animation bar */}
      <div className="w-64 h-3 bg-lime-200 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-ev-green-500 rounded-full animate-charging" />
      </div>

      {/* Back button */}
      <Link
        href={`/${locale}`}
        className="px-5 py-2 text-gray-600 text-sm font-medium rounded-lg transition-colors hover:opacity-80"
        style={{ backgroundColor: '#51bf24' }}
      >
        {backText}
      </Link>

      {/* Add custom animation styles */}
      <style jsx>{`
        @keyframes charging {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 30%;
          }
        }
        .animate-charging {
          animation: charging 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
