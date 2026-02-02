import { NextResponse } from "next/server";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// Stock symbols for EV companies
const STOCKS = [
  { symbol: "1211.HK", name: "BYD" },
  { symbol: "LI", name: "Li Auto" },
  { symbol: "NIO", name: "NIO" },
  { symbol: "XPEV", name: "XPeng" },
];

// Cache for stock data (5 minutes TTL)
let cachedData: StockData[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface YahooQuote {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

async function fetchStockData(): Promise<StockData[]> {
  // Check cache first
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return cachedData;
  }

  try {
    // Dynamic import for yahoo-finance2 (CommonJS module)
    const yahooFinance = await import("yahoo-finance2").then(
      (m) => m.default || m
    );

    const results: StockData[] = [];

    for (const stock of STOCKS) {
      try {
        const quote = (await yahooFinance.quote(stock.symbol)) as YahooQuote;
        results.push({
          symbol: stock.symbol,
          name: stock.name,
          price: quote?.regularMarketPrice || 0,
          change: quote?.regularMarketChange || 0,
          changePercent: quote?.regularMarketChangePercent || 0,
        });
      } catch {
        // If individual stock fails, add with zeros
        results.push({
          symbol: stock.symbol,
          name: stock.name,
          price: 0,
          change: 0,
          changePercent: 0,
        });
      }
    }

    // Update cache
    cachedData = results;
    cacheTime = Date.now();

    return results;
  } catch {
    // Return cached data if available, otherwise return placeholder
    if (cachedData) {
      return cachedData;
    }

    // Return placeholder data
    return STOCKS.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      price: 0,
      change: 0,
      changePercent: 0,
    }));
  }
}

export async function GET() {
  try {
    const data = await fetchStockData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
