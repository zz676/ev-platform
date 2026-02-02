"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const defaultStocks: StockData[] = [
  { symbol: "1211.HK", name: "BYD", price: 0, change: 0, changePercent: 0 },
  { symbol: "LI", name: "Li Auto", price: 0, change: 0, changePercent: 0 },
  { symbol: "NIO", name: "NIO", price: 0, change: 0, changePercent: 0 },
  { symbol: "XPEV", name: "XPeng", price: 0, change: 0, changePercent: 0 },
];

export function MarketTicker() {
  const [stocks, setStocks] = useState<StockData[]>(defaultStocks);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStocks() {
      try {
        const response = await fetch("/api/stocks");
        if (response.ok) {
          const data = await response.json();
          setStocks(data);
        }
      } catch {
        // Keep default data on error
      } finally {
        setLoading(false);
      }
    }

    fetchStocks();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStocks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 text-sm">
      {stocks.map((stock) => (
        <div key={stock.symbol} className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700">{stock.name}</span>
          {loading ? (
            <span className="text-gray-400">--</span>
          ) : (
            <>
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  stock.change >= 0 ? "text-ev-green-600" : "text-red-500"
                )}
              >
                {stock.change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {stock.change >= 0 ? "+" : ""}
                  {stock.changePercent.toFixed(1)}%
                </span>
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
