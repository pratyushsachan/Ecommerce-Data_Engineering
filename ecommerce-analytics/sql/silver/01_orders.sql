-- Clean orders: remove duplicate order IDs, drop invalid rows,
-- and add product price, category, and customer region.
CREATE OR REPLACE TABLE silver_orders AS
WITH deduped AS (
    SELECT DISTINCT ON (order_id) *
    FROM bronze_orders
    ORDER BY order_id
)
SELECT
    o.order_id,
    o.customer_id,
    o.product_id,
    CAST(o.order_ts AS DATE) AS order_date,
    o.order_ts,
    o.quantity,
    o.status,
    p.category,
    p.unit_price,
    o.quantity * p.unit_price AS revenue,
    c.region
FROM deduped o
LEFT JOIN bronze_products p ON p.product_id = o.product_id
LEFT JOIN bronze_customers c ON c.customer_id = o.customer_id
WHERE o.quantity > 0
  AND o.customer_id IS NOT NULL
  AND o.status IN ('completed', 'cancelled', 'returned');
