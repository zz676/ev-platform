const CANONICAL_TABLES = new Set([
  "eVMetric",
  "automakerRankings",
  "caamNevSales",
  "cpcaNevRetail",
  "cpcaNevProduction",
  "nevSalesSummary",
  "chinaPassengerInventory",
  "chinaDealerInventoryFactor",
  "chinaViaIndex",
  "chinaBatteryInstallation",
  "batteryMakerMonthly",
  "batteryMakerRankings",
  "plantExports",
  "vehicleSpec",
]);

const ALIASES: Record<string, string> = {
  // LLM-friendly / model-ish names (PascalCase)
  evmetric: "eVMetric",
  automakerrankings: "automakerRankings",
  caamnevsales: "caamNevSales",
  cpcanevretail: "cpcaNevRetail",
  cpcanevproduction: "cpcaNevProduction",
  nevsalessummary: "nevSalesSummary",
  chinapassengerinventory: "chinaPassengerInventory",
  chinadealerinventoryfactor: "chinaDealerInventoryFactor",
  chinaviaindex: "chinaViaIndex",
  chinabatteryinstallation: "chinaBatteryInstallation",
  batterymakermonthly: "batteryMakerMonthly",
  batterymakerrankings: "batteryMakerRankings",
  plantexports: "plantExports",
  vehiclespec: "vehicleSpec",

  // Extra common variants
  ev_metric: "eVMetric",
  evmetrics: "eVMetric",
};

/**
 * Normalize user/LLM-provided table names to the canonical Prisma client table key
 * (e.g. "EVMetric" -> "eVMetric").
 */
export function normalizeTableName(raw: string): string {
  const cleaned = (raw || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "") // strip wrapping quotes
    .replace(/\s+/g, "");

  if (CANONICAL_TABLES.has(cleaned)) return cleaned;

  const lower = cleaned.toLowerCase();
  return ALIASES[lower] || cleaned;
}

