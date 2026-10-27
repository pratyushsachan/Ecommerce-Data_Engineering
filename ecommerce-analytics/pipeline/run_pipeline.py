"""Run the e-commerce pipeline end to end.

Steps:
  1. Generate sample raw files (bronze inputs)
  2. Bronze: load raw CSVs into DuckDB without changes
  3. Silver: clean and join the data
  4. Tests: data-quality checks. If any fail, stop before the gold layer is rebuilt.
  5. Gold: build business tables
  6. Export: write gold tables and run status as JSON for the dashboard
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from generate_data import RAW_DIR, generate

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "warehouse.duckdb"
SQL_DIR = ROOT / "sql"
EXPORT_DIR = ROOT / "web" / "data"
GOLD_TABLES = ["gold_daily_revenue", "gold_category_summary"]


def load_bronze(con: duckdb.DuckDBPyConnection) -> None:
    """Load each raw CSV as-is, adding a load timestamp. No cleaning here."""
    for name in ["customers", "products", "orders"]:
        path = (RAW_DIR / f"{name}.csv").as_posix()
        con.execute(f"""
            CREATE OR REPLACE TABLE bronze_{name} AS
            SELECT *, current_timestamp AS _loaded_at
            FROM read_csv_auto('{path}', header = true)
        """)


def run_sql_folder(con: duckdb.DuckDBPyConnection, folder: Path) -> None:
    """Run every .sql file in a folder, in filename order."""
    for sql_file in sorted(folder.glob("*.sql")):
        con.execute(sql_file.read_text())
        print(f"  ran {sql_file.relative_to(ROOT).as_posix()}")


def run_tests(con: duckdb.DuckDBPyConnection) -> dict[str, int]:
    """Each test query returns the rows that fail. Zero rows means the test passes."""
    results = {}
    for sql_file in sorted((SQL_DIR / "tests").glob("*.sql")):
        failing_rows = con.execute(sql_file.read_text()).fetchall()
        results[sql_file.stem] = len(failing_rows)
        print(f"  {sql_file.stem}: {len(failing_rows)} failing rows")
    return results


def export_for_dashboard(con: duckdb.DuckDBPyConnection, status: dict) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    for table in GOLD_TABLES:
        df = con.execute(f"SELECT * FROM {table}").df()
        df.to_json(EXPORT_DIR / f"{table}.json", orient="records", date_format="iso")
    (EXPORT_DIR / "pipeline_status.json").write_text(json.dumps(status, indent=2))
    print(f"  exported {len(GOLD_TABLES)} tables and status to web/data/")


def main() -> None:
    generate()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))
    ran_at = datetime.now(timezone.utc).isoformat()

    print("Bronze: loading raw files")
    load_bronze(con)

    print("Silver: cleaning")
    run_sql_folder(con, SQL_DIR / "silver")

    bronze_orders = con.execute("SELECT COUNT(*) FROM bronze_orders").fetchone()[0]
    silver_orders = con.execute("SELECT COUNT(*) FROM silver_orders").fetchone()[0]

    print("Tests: data quality")
    tests = run_tests(con)
    failed = {name: n for name, n in tests.items() if n > 0}
    if failed:
        print(f"Tests failed, gold layer not rebuilt: {failed}")
        sys.exit(1)

    print("Gold: building business tables")
    run_sql_folder(con, SQL_DIR / "gold")

    print("Export: writing dashboard data")
    status = {
        "ran_at": ran_at,
        "bronze_orders": bronze_orders,
        "silver_orders": silver_orders,
        "rows_removed": bronze_orders - silver_orders,
        "tests": tests,
    }
    export_for_dashboard(con, status)
    print(f"Done. Raw orders: {bronze_orders}, clean orders: {silver_orders}")


if __name__ == "__main__":
    main()
