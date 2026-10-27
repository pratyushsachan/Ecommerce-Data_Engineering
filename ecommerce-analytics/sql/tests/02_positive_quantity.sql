-- Quantity must be greater than zero. Returns invalid rows if any.
SELECT order_id, quantity
FROM silver_orders
WHERE quantity <= 0;
