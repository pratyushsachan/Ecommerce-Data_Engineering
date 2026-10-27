import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Files exported by pipeline/run_pipeline.py into web/data/.
const FILES = [
  "gold_daily_revenue",
  "gold_category_summary",
  "pipeline_status",
] as const;

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");

  const entries = await Promise.all(
    FILES.map(async (name) => {
      const raw = await readFile(path.join(dataDir, `${name}.json`), "utf-8");
      return [name, JSON.parse(raw)] as const;
    })
  );

  return NextResponse.json(Object.fromEntries(entries));
}
