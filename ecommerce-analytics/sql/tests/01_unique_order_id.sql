-- Each order_id should appear once in silver. Returns duplicates if any.
SELECT order_id, COUNT(*) AS n
FROM silver_orders
GROUP BY order_id
HAVING COUNT(*) > 1;
