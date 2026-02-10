import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { executeQuery, getTableInfo } from "@/lib/query-executor";

function normalizeOrderBy(orderBy: unknown): unknown {
  if (!orderBy) return orderBy;
  if (Array.isArray(orderBy)) return orderBy;
  if (typeof orderBy === "object") {
    const entries = Object.entries(orderBy as Record<string, unknown>);
    if (entries.length === 0) return orderBy;
    return entries.map(([key, value]) => ({ [key]: value }));
  }
  return orderBy;
}

// POST: Execute a query safely
export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { table, query } = body;

    if (!table || typeof table !== "string") {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    if (!query || typeof query !== "object") {
      return NextResponse.json(
        { error: "Query object is required" },
        { status: 400 }
      );
    }

    const normalizedQuery = {
      ...query,
      ...(query?.orderBy !== undefined
        ? { orderBy: normalizeOrderBy(query.orderBy) }
        : {}),
    };

    const result = await executeQuery({ table, query: normalizedQuery });

    // Get table info for context
    const tableInfo = getTableInfo(table);

    return NextResponse.json({
      data: result.data,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs,
      tableInfo,
    });
  } catch (error) {
    console.error("Error executing query:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to execute query";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
