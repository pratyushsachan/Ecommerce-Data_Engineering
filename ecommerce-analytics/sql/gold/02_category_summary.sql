-- Revenue, completed orders, and return rate by product category.
CREATE OR REPLACE TABLE gold_category_summary AS
SELECT
    category,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
    ROUND(SUM(revenue) FILTER (WHERE status = 'completed'), 2) AS revenue,
    ROUND(COUNT(*) FILTER (WHERE status = 'returned') * 1.0 / COUNT(*), 4) AS return_rate
FROM silver_orders
GROUP BY category
ORDER BY revenue DESC;
