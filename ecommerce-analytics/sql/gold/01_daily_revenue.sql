-- Daily completed revenue and order count, by region.
CREATE OR REPLACE TABLE gold_daily_revenue AS
SELECT
    order_date,
    region,
    COUNT(*) AS order_count,
    ROUND(SUM(revenue), 2) AS revenue
FROM silver_orders
WHERE status = 'completed'
GROUP BY order_date, region
ORDER BY order_date, region;
