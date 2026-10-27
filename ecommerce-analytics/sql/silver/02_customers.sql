-- Clean customers: one row per customer, with a typed signup date.
CREATE OR REPLACE TABLE silver_customers AS
SELECT DISTINCT ON (customer_id)
    customer_id,
    customer_name,
    region,
    CAST(signup_date AS DATE) AS signup_date
FROM bronze_customers
ORDER BY customer_id;
