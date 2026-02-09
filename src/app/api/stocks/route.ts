import { NextResponse } from "next/server";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  category: "ev" | "traditional";
}

// Stock symbols for EV companies and traditional automakers
const STOCKS = [
  // Top 10 EV Companies
  { symbol: "TSLA", name: "Tesla", category: "ev" as const },
  { symbol: "1211.HK", name: "BYD", category: "ev" as const },
  { symbol: "LI", name: "Li Auto", category: "ev" as const },
  { symbol: "NIO", name: "NIO", category: "ev" as const },
  { symbol: "XPEV", name: "XPeng", category: "ev" as const },
  { symbol: "RIVN", name: "Rivian", category: "ev" as const },
  { symbol: "LCID", name: "Lucid", category: "ev" as const },
  { symbol: "PSNY", name: "Polestar", category: "ev" as const },
  { symbol: "VFS", name: "VinFast", category: "ev" as const },
  { symbol: "ZEEKR", name: "Zeekr", category: "ev" as const },
  // Top 5 Traditional Automakers
  { symbol: "TM", name: "Toyota", category: "traditional" as const },
  { symbol: "VWAGY", name: "Volkswagen", category: "traditional" as const },
  { symbol: "GM", name: "General Motors", category: "traditional" as const },
  { symbol: "F", name: "Ford", category: "traditional" as const },
  { symbol: "STLA", name: "Stellantis", category: "traditional" as const },
];

// Cache for stock data (5 minutes TTL)
let cachedData: StockData[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Singleton instance of YahooFinance
let yahooFinanceInstance: InstanceType<typeof import("yahoo-finance2").default> | null = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const YahooFinance = (await import("yahoo-finance2")).default;
    yahooFinanceInstance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  }
  return yahooFinanceInstance;
}

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
    const yahooFinance = await getYahooFinance();

    // Fetch all stocks in parallel for better performance
    const results = await Promise.all(
      STOCKS.map(async (stock) => {
        try {
          const quote = (await yahooFinance.quote(stock.symbol)) as YahooQuote;
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: quote?.regularMarketPrice || 0,
            change: quote?.regularMarketChange || 0,
            changePercent: quote?.regularMarketChangePercent || 0,
            category: stock.category,
          };
        } catch (err) {
          console.error(`Failed to fetch ${stock.symbol}:`, err);
          // If individual stock fails, add with zeros
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: 0,
            change: 0,
            changePercent: 0,
            category: stock.category,
          };
        }
      })
    );

    // Update cache
    cachedData = results;
    cacheTime = Date.now();

    return results;
  } catch (err) {
    console.error("Failed to fetch stock data:", err);
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
      category: stock.category,
    }));
  }
}

export async function GET() {
  try {
    const data = await fetchStockData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
