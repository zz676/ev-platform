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

function parseSqlStringLiteral(value: string): string {
  if (!value.startsWith("'") || !value.endsWith("'")) return value;
  const inner = value.slice(1, -1);
  return inner.replace(/''/g, "'");
}

function parseSqlValue(raw: string): unknown {
  const value = raw.trim();
  if (!value) return "";
  if (/^null$/i.test(value)) return null;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (value.startsWith("'") && value.endsWith("'")) return parseSqlStringLiteral(value);
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  return value;
}

function splitSqlList(list: string): string[] {
  const parts: string[] = [];
  const regex = /'(?:''|[^'])*'|[^,]+/g;
  const matches = list.match(regex);
  if (!matches) return [];
  for (const part of matches) {
    const trimmed = part.trim();
    if (trimmed) parts.push(trimmed);
  }
  return parts;
}

function parseSqlField(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.replace(/"/g, "");
}

function parseWhereClause(wherePart: string): Record<string, unknown> | null {
  if (!wherePart) return null;
  const normalized = wherePart.trim();
  if (!normalized || /^true$/i.test(normalized) || /^1\s*=\s*1$/i.test(normalized)) {
    return null;
  }
  if (/\s+or\s+/i.test(normalized)) {
    return null;
  }
  const conditions = normalized.split(/\s+and\s+/i);
  const where: Record<string, unknown> = {};

  for (const condition of conditions) {
    const cond = condition.trim();
    if (!cond) continue;

    let match = cond.match(/^"([^"]+)"\s+is\s+null$/i);
    if (match) {
      where[match[1]] = null;
      continue;
    }
    match = cond.match(/^"([^"]+)"\s+is\s+not\s+null$/i);
    if (match) {
      where[match[1]] = { not: null };
      continue;
    }

    match = cond.match(/^"([^"]+)"\s+(not\s+in|in)\s*\((.+)\)$/i);
    if (match) {
      const field = match[1];
      const op = match[2].toLowerCase();
      const list = splitSqlList(match[3]);
      const values = list.map(parseSqlValue);
      if (op.includes("not")) {
        where[field] = { notIn: values };
      } else {
        where[field] = { in: values };
      }
      continue;
    }

    match = cond.match(/^"([^"]+)"\s+ilike\s+(.+)$/i);
    if (match) {
      const field = match[1];
      const pattern = parseSqlValue(match[2]) as string;
      if (typeof pattern !== "string") return null;
      if (pattern.startsWith("%") && pattern.endsWith("%")) {
        where[field] = { contains: pattern.slice(1, -1) };
      } else if (pattern.startsWith("%")) {
        where[field] = { endsWith: pattern.slice(1) };
      } else if (pattern.endsWith("%")) {
        where[field] = { startsWith: pattern.slice(0, -1) };
      } else {
        where[field] = { equals: pattern };
      }
      continue;
    }

    match = cond.match(/^"([^"]+)"\s*(=|<>|<=|>=|<|>)\s*(.+)$/);
    if (match) {
      const field = match[1];
      const op = match[2];
      const value = parseSqlValue(match[3]);
      if (op === "=") {
        if (where[field] && typeof where[field] === "object" && !Array.isArray(where[field])) {
          (where[field] as Record<string, unknown>).equals = value;
        } else {
          where[field] = value;
        }
      } else if (op === "<>") {
        where[field] = { not: value };
      } else {
        const bucket =
          where[field] && typeof where[field] === "object" && !Array.isArray(where[field])
            ? (where[field] as Record<string, unknown>)
            : ((where[field] = {}) as Record<string, unknown>);
        if (op === "<") bucket.lt = value;
        if (op === "<=") bucket.lte = value;
        if (op === ">") bucket.gt = value;
        if (op === ">=") bucket.gte = value;
      }
      continue;
    }

    // Unsupported condition
    return null;
  }

  return Object.keys(where).length ? where : null;
}

function parseSelectClause(selectPart: string): Record<string, boolean> | null {
  const trimmed = selectPart.trim();
  if (trimmed === "*") return null;
  const fields = trimmed.split(",").map((f) => f.trim()).filter(Boolean);
  if (!fields.length) return null;
  const select: Record<string, boolean> = {};
  for (const field of fields) {
    const cleaned = parseSqlField(field.split(".").pop() || field);
    if (cleaned) select[cleaned] = true;
  }
  return Object.keys(select).length ? select : null;
}

function parseOrderByClause(orderPart: string): Array<Record<string, "asc" | "desc">> | null {
  const trimmed = orderPart.trim();
  if (!trimmed) return null;
  const pieces = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (!pieces.length) return null;
  const orderBy: Array<Record<string, "asc" | "desc">> = [];
  for (const piece of pieces) {
    const match = piece.match(/^"([^"]+)"\s+(asc|desc)$/i);
    if (!match) return null;
    orderBy.push({ [match[1]]: match[2].toLowerCase() as "asc" | "desc" });
  }
  return orderBy.length ? orderBy : null;
}

export function sqlToPrismaFindMany(sql: string): Record<string, unknown> | null {
  if (!sql) return null;
  const cleaned = sql.replace(/^\s*--.*$/gm, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/;$/, "").trim();
  const compact = normalized.replace(/\s+/g, " ").trim();

  const match = compact.match(
    /^select\s+(.+?)\s+from\s+(.+?)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+))?(?:\s+offset\s+(\d+))?$/i
  );
  if (!match) return null;

  const selectPart = match[1];
  const wherePart = match[3] || "";
  const orderPart = match[4] || "";
  const limitPart = match[5];
  const offsetPart = match[6];

  const query: Record<string, unknown> = {};

  const select = parseSelectClause(selectPart);
  if (select) query.select = select;

  const where = parseWhereClause(wherePart);
  if (where) query.where = where;

  const orderBy = parseOrderByClause(orderPart);
  if (orderBy) query.orderBy = orderBy;

  if (limitPart) query.take = Number(limitPart);
  if (offsetPart) query.skip = Number(offsetPart);

  return query;
}
