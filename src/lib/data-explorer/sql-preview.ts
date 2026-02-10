type PrismaOrder = "asc" | "desc";

const PRISMA_TO_SQL_TABLE: Record<string, string> = {
  eVMetric: "EVMetric",
  automakerRankings: "AutomakerRankings",
  caamNevSales: "CaamNevSales",
  cpcaNevRetail: "CpcaNevRetail",
  cpcaNevProduction: "CpcaNevProduction",
  nevSalesSummary: "NevSalesSummary",
  chinaPassengerInventory: "ChinaPassengerInventory",
  chinaDealerInventoryFactor: "ChinaDealerInventoryFactor",
  chinaViaIndex: "ChinaViaIndex",
  chinaBatteryInstallation: "ChinaBatteryInstallation",
  batteryMakerMonthly: "BatteryMakerMonthly",
  batteryMakerRankings: "BatteryMakerRankings",
  plantExports: "PlantExports",
  vehicleSpec: "VehicleSpec",
};

function qIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function qString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function qValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return qString(value.toISOString());
  if (typeof value === "string") return qString(value);
  if (Array.isArray(value)) return `(${value.map(qValue).join(", ")})`;
  return qString(JSON.stringify(value));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function whereToSql(where: unknown): string {
  if (!where || !isObject(where)) return "TRUE";

  const parts: string[] = [];

  for (const [key, raw] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(raw)) {
      const sub = raw.map(whereToSql).filter(Boolean);
      if (sub.length) parts.push(`(${sub.join(" AND ")})`);
      continue;
    }
    if (key === "OR" && Array.isArray(raw)) {
      const sub = raw.map(whereToSql).filter(Boolean);
      if (sub.length) parts.push(`(${sub.join(" OR ")})`);
      continue;
    }
    if (key === "NOT") {
      parts.push(`(NOT (${whereToSql(raw)}))`);
      continue;
    }

    const col = qIdent(key);

    if (raw === null) {
      parts.push(`${col} IS NULL`);
      continue;
    }

    if (!isObject(raw) || raw instanceof Date) {
      parts.push(`${col} = ${qValue(raw)}`);
      continue;
    }

    // Prisma field filters: { in, not, lte, gte, lt, gt, contains, startsWith, endsWith, equals }
    if ("equals" in raw) parts.push(`${col} = ${qValue(raw.equals)}`);
    if ("in" in raw && Array.isArray(raw.in) && raw.in.length) {
      parts.push(`${col} IN ${qValue(raw.in)}`);
    }
    if ("notIn" in raw && Array.isArray(raw.notIn) && raw.notIn.length) {
      parts.push(`${col} NOT IN ${qValue(raw.notIn)}`);
    }
    if ("not" in raw) {
      if (raw.not === null) parts.push(`${col} IS NOT NULL`);
      else parts.push(`${col} <> ${qValue(raw.not)}`);
    }
    if ("lte" in raw) parts.push(`${col} <= ${qValue(raw.lte)}`);
    if ("gte" in raw) parts.push(`${col} >= ${qValue(raw.gte)}`);
    if ("lt" in raw) parts.push(`${col} < ${qValue(raw.lt)}`);
    if ("gt" in raw) parts.push(`${col} > ${qValue(raw.gt)}`);

    if (typeof raw.contains === "string") {
      parts.push(`${col} ILIKE ${qString(`%${raw.contains}%`)}`);
    }
    if (typeof raw.startsWith === "string") {
      parts.push(`${col} ILIKE ${qString(`${raw.startsWith}%`)}`);
    }
    if (typeof raw.endsWith === "string") {
      parts.push(`${col} ILIKE ${qString(`%${raw.endsWith}`)}`);
    }

    // If we couldn't recognize any operator, fallback to equality on the object JSON.
    const recognizedKeys = new Set([
      "equals",
      "in",
      "notIn",
      "not",
      "lte",
      "gte",
      "lt",
      "gt",
      "contains",
      "startsWith",
      "endsWith",
    ]);
    const hasRecognized = Object.keys(raw).some((k) => recognizedKeys.has(k));
    if (!hasRecognized) {
      parts.push(`${col} = ${qValue(raw)}`);
    }
  }

  return parts.length ? parts.join(" AND ") : "TRUE";
}

function orderByToSql(orderBy: unknown): string {
  if (!orderBy) return "";
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts: string[] = [];

  for (const item of items) {
    if (!isObject(item)) continue;
    for (const [field, dir] of Object.entries(item)) {
      const d = String(dir).toLowerCase() as PrismaOrder;
      const sqlDir = d === "desc" ? "DESC" : "ASC";
      parts.push(`${qIdent(field)} ${sqlDir}`);
    }
  }

  return parts.length ? `ORDER BY ${parts.join(", ")}` : "";
}

function selectToSql(select: unknown): string {
  if (!select || !isObject(select)) return "*";
  const fields = Object.entries(select)
    .filter(([, v]) => v === true)
    .map(([k]) => qIdent(k));
  return fields.length ? fields.join(", ") : "*";
}

export function prismaFindManyToSql(params: {
  table: string;
  query: Record<string, unknown>;
}): string {
  const sqlTable = PRISMA_TO_SQL_TABLE[params.table] || params.table;
  const tableIdent = qIdent(sqlTable);

  const select = selectToSql(params.query.select);
  const where = whereToSql(params.query.where);
  const orderBy = orderByToSql(params.query.orderBy);
  const take =
    typeof params.query.take === "number" ? `LIMIT ${params.query.take}` : "";
  const skip =
    typeof params.query.skip === "number" ? `OFFSET ${params.query.skip}` : "";

  const warnings: string[] = [];
  if (params.query.distinct) {
    warnings.push(
      "distinct is not fully represented in this SQL preview (Prisma distinct semantics differ)."
    );
  }

  const header = warnings.length
    ? `-- NOTE: ${warnings.join(" ")}\n`
    : "";

  return `${header}SELECT ${select}\nFROM ${tableIdent}\nWHERE ${where}\n${orderBy}\n${take}\n${skip}`.trim() + ";";
}

