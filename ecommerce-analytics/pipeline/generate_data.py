"""Generate synthetic e-commerce source files (the bronze inputs).

The data includes deliberate problems (duplicate orders, negative quantities,
missing customer IDs) so the cleaning and data-quality steps have real work to do.
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
SEED = 42


def generate(n_customers: int = 500, n_products: int = 60, n_orders: int = 5000) -> None:
    rng = np.random.default_rng(SEED)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    regions = ["North", "South", "East", "West"]
    categories = ["Electronics", "Home", "Apparel", "Grocery", "Sports"]

    customers = pd.DataFrame({
        "customer_id": [f"C{i:04d}" for i in range(1, n_customers + 1)],
        "customer_name": [f"Customer {i}" for i in range(1, n_customers + 1)],
        "region": rng.choice(regions, n_customers),
        "signup_date": pd.to_datetime("2024-01-01")
        + pd.to_timedelta(rng.integers(0, 600, n_customers), unit="D"),
    })

    products = pd.DataFrame({
        "product_id": [f"P{i:03d}" for i in range(1, n_products + 1)],
        "category": rng.choice(categories, n_products),
        "unit_price": rng.uniform(5, 500, n_products).round(2),
    })

    orders = pd.DataFrame({
        "order_id": [f"O{i:06d}" for i in range(1, n_orders + 1)],
        "customer_id": rng.choice(customers["customer_id"], n_orders),
        "product_id": rng.choice(products["product_id"], n_orders),
        "order_ts": pd.to_datetime("2025-01-01")
        + pd.to_timedelta(rng.integers(0, 300 * 24 * 60, n_orders), unit="m"),
        "quantity": rng.integers(1, 6, n_orders),
        "status": rng.choice(
            ["completed", "completed", "completed", "cancelled", "returned"], n_orders
        ),
    })

    # Inject realistic problems for the pipeline to catch.
    orders.loc[rng.choice(n_orders, 40, replace=False), "quantity"] = -1
    orders.loc[rng.choice(n_orders, 60, replace=False), "customer_id"] = None
    duplicates = orders.sample(50, random_state=SEED)
    orders = pd.concat([orders, duplicates], ignore_index=True)

    customers.to_csv(RAW_DIR / "customers.csv", index=False)
    products.to_csv(RAW_DIR / "products.csv", index=False)
    orders.to_csv(RAW_DIR / "orders.csv", index=False)
    print(f"Generated raw files in {RAW_DIR.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    generate()
