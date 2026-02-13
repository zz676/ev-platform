"use client";

import { useEffect, useState } from "react";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  category: "ev" | "traditional";
}

export function StockTicker() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const fetchStocks = async () => {
    try {
      const response = await fetch("/api/stocks");
      if (response.ok) {
        const data = await response.json();
        setStocks(data);
      }
    } catch (error) {
      console.error("Failed to fetch stocks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchStocks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-lime-500 text-gray-900 py-[0.425rem] overflow-hidden">
        <div className="flex items-center justify-center text-ticker text-gray-800">
          Loading stock data...
        </div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return null;
  }

  const formatPrice = (price: number) => {
    if (price === 0) return "N/A";
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (changePercent: number) => {
    if (changePercent === 0) return "0.00%";
    const sign = changePercent > 0 ? "+" : "";
    return `${sign}${changePercent.toFixed(2)}%`;
  };

  // Create stock items for the ticker
  const StockItem = ({ stock }: { stock: StockData }) => {
    const isPositive = stock.changePercent > 0;
    const isNegative = stock.changePercent < 0;
    const changeColor = isPositive
      ? "text-green-800"
      : isNegative
        ? "text-red-700"
        : "text-gray-700";
    const arrow = isPositive ? "▲" : isNegative ? "▼" : "";

    return (
      <span className="inline-flex items-center mx-6 whitespace-nowrap text-ticker">
        <span className="font-medium text-gray-900">{stock.name}</span>
        <span className="mx-2 text-gray-800">{formatPrice(stock.price)}</span>
        <span className={`${changeColor} font-medium`}>
          {arrow}
          {formatChange(stock.changePercent)}
        </span>
      </span>
    );
  };

  // Duplicate the stocks array for seamless infinite scroll
  const tickerContent = (
    <>
      {stocks.map((stock, index) => (
        <StockItem key={`first-${stock.symbol}-${index}`} stock={stock} />
      ))}
      {stocks.map((stock, index) => (
        <StockItem key={`second-${stock.symbol}-${index}`} stock={stock} />
      ))}
    </>
  );

  return (
    <a
      href="https://finance.yahoo.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-lime-500 text-gray-900 py-[0.425rem] overflow-hidden cursor-pointer"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`flex animate-marquee ${isPaused ? "[animation-play-state:paused]" : ""}`}
      >
        {tickerContent}
      </div>
    </a>
  );
}
