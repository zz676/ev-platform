import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { normalizeTableName } from "@/lib/data-explorer/table-name";

// Whitelist of allowed tables (read-only access)
const ALLOWED_TABLES = [
  // Brand-level data
  "eVMetric",
  "automakerRankings",

  // Industry-level data
  "caamNevSales",
  "cpcaNevRetail",
  "cpcaNevProduction",
  "nevSalesSummary",

  // Market health indicators
  "chinaPassengerInventory",
  "chinaDealerInventoryFactor",
  "chinaViaIndex",

  // Battery industry
  "chinaBatteryInstallation",
  "batteryMakerMonthly",
  "batteryMakerRankings",

  // Exports
  "plantExports",

  // Vehicle specs
  "vehicleSpec",
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

// Maximum results to return
const MAX_RESULTS = 1000;

// Query timeout in milliseconds
const QUERY_TIMEOUT = 5000;

// Allowed query keys for Prisma findMany
const ALLOWED_QUERY_KEYS = [
  "where",
  "orderBy",
  "take",
  "skip",
  "select",
  "distinct",
];

export interface QueryRequest {
  table: string;
  query: Record<string, unknown>;
}

export interface QueryResult {
  table: string;
  data: unknown[];
  rowCount: number;
  executionTimeMs: number;
}

/**
 * Validate that the query doesn't contain dangerous operations
 */
function validateQueryStructure(query: Record<string, unknown>): void {
  const queryKeys = Object.keys(query);

  // Check for disallowed keys
  for (const key of queryKeys) {
    if (!ALLOWED_QUERY_KEYS.includes(key)) {
      throw new Error(
        `Query key "${key}" is not allowed. Allowed keys: ${ALLOWED_QUERY_KEYS.join(", ")}`
      );
    }
  }

  // Check for dangerous patterns in values (SQL injection-like patterns)
  const queryStr = JSON.stringify(query);
  const dangerousPatterns = [
    /\$queryRaw/i,
    /\$executeRaw/i,
    /delete/i,
    /update/i,
    /create/i,
    /drop/i,
    /truncate/i,
    /alter/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(queryStr)) {
      throw new Error(`Query contains dangerous pattern: ${pattern.source}`);
    }
  }
}

/**
 * Create a timeout promise
 */
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
  );
}

/**
 * Execute a query safely with validation and limits
 */
export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const { table, query } = request;
  const startTime = Date.now();

  const normalizedTable = normalizeTableName(table);

  // 1. Validate table is allowed
  if (!ALLOWED_TABLES.includes(normalizedTable as AllowedTable)) {
    throw new Error(
      `Table "${table}" is not allowed. Allowed tables: ${ALLOWED_TABLES.join(", ")}`
    );
  }

  // 2. Validate query structure
  validateQueryStructure(query);

  // 3. Add safety limits
  const safeQuery = {
    ...query,
    take: Math.min(
      (query.take as number) || MAX_RESULTS,
      MAX_RESULTS
    ),
  };

  // 4. Execute with timeout
  const prismaTable = (prisma as unknown as Record<string, { findMany: (query: unknown) => Promise<unknown[]> }>)[normalizedTable];
  if (!prismaTable || typeof prismaTable.findMany !== "function") {
    throw new Error(`Table "${normalizedTable}" not found in Prisma client`);
  }

  try {
    const result = await Promise.race([
      prismaTable.findMany(safeQuery),
      timeout(QUERY_TIMEOUT),
    ]);

    const executionTimeMs = Date.now() - startTime;

    return {
      table: normalizedTable,
      data: result as unknown[],
      rowCount: (result as unknown[]).length,
      executionTimeMs,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new Error(`Database error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get schema information for a table
 */
export function getTableInfo(
  table: string
): { fields: string[]; description: string } | null {
  const tableInfo: Record<
    string,
    { fields: string[]; description: string }
  > = {
    eVMetric: {
      fields: [
        "brand",
        "metric",
        "periodType",
        "year",
        "period",
        "value",
        "yoyChange",
        "momChange",
        "marketShare",
        "ranking",
      ],
      description: "Brand delivery/sales data",
    },
    automakerRankings: {
      fields: [
        "dataSource",
        "year",
        "month",
        "ranking",
        "automaker",
        "value",
        "yoyChange",
        "momChange",
        "marketShare",
      ],
      description: "Monthly automaker sales rankings",
    },
    caamNevSales: {
      fields: ["year", "month", "value", "yoyChange", "momChange", "unit"],
      description: "CAAM official NEV sales (includes exports)",
    },
    cpcaNevRetail: {
      fields: ["year", "month", "value", "yoyChange", "momChange", "unit"],
      description: "CPCA NEV retail sales (consumer registrations)",
    },
    cpcaNevProduction: {
      fields: ["year", "month", "value", "yoyChange", "momChange", "unit"],
      description: "CPCA NEV production volume",
    },
    chinaPassengerInventory: {
      fields: ["year", "month", "value", "unit"],
      description: "Dealer + factory inventory levels (million units)",
    },
    chinaDealerInventoryFactor: {
      fields: ["year", "month", "value", "unit"],
      description: "Dealer inventory coefficient (>1.5=oversupply, <0.8=shortage)",
    },
    chinaViaIndex: {
      fields: ["year", "month", "value", "unit"],
      description: "Vehicle Inventory Alert Index (>50%=contraction)",
    },
    chinaBatteryInstallation: {
      fields: ["year", "month", "installation", "production", "unit"],
      description: "Total battery installation & production (GWh)",
    },
    batteryMakerMonthly: {
      fields: [
        "maker",
        "year",
        "month",
        "installation",
        "production",
        "yoyChange",
      ],
      description: "Battery maker monthly performance",
    },
    batteryMakerRankings: {
      fields: [
        "dataSource",
        "scope",
        "periodType",
        "year",
        "month",
        "ranking",
        "maker",
        "value",
        "marketShare",
      ],
      description: "Battery maker market share rankings",
    },
    plantExports: {
      fields: ["plant", "brand", "year", "month", "value", "yoyChange"],
      description: "Exports by manufacturing plant",
    },
    vehicleSpec: {
      fields: [
        "brand",
        "model",
        "variant",
        "startingPrice",
        "currentPrice",
        "rangeCltc",
        "acceleration",
        "batteryCapacity",
        "vehicleType",
      ],
      description: "Vehicle specifications",
    },
    nevSalesSummary: {
      fields: [
        "dataSource",
        "year",
        "startDate",
        "endDate",
        "retailSales",
        "retailYoy",
        "wholesaleSales",
        "wholesaleYoy",
      ],
      description: "Weekly/bi-weekly sales flash reports",
    },
  };

  return tableInfo[table] || null;
}

/**
 * Get list of allowed tables with descriptions
 */
export function getAllowedTables(): Array<{ name: string; description: string }> {
  return ALLOWED_TABLES.map((table) => {
    const info = getTableInfo(table);
    return {
      name: table,
      description: info?.description || "",
    };
  });
}
