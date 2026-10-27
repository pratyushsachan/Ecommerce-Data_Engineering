-- Every order needs a price so revenue can be calculated. Returns rows missing revenue.
SELECT order_id
FROM silver_orders
WHERE revenue IS NULL;
