import { NextResponse } from "next/server";
import daily from "../../../data/gold_daily_revenue.json";
import categories from "../../../data/gold_category_summary.json";
import status from "../../../data/pipeline_status.json";

// The JSON files are exported by pipeline/run_pipeline.py into web/data/.
// They are imported directly, so they are bundled at build time.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    gold_daily_revenue: daily,
    gold_category_summary: categories,
    pipeline_status: status,
  });
}
