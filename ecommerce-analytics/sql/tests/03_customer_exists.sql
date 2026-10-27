-- Every order must belong to a known customer. Returns orphan orders if any.
SELECT o.order_id
FROM silver_orders o
LEFT JOIN silver_customers c ON c.customer_id = o.customer_id
WHERE c.customer_id IS NULL;
