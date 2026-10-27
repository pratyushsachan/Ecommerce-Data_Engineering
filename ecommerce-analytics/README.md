# E-commerce Analytics Pipeline

An end-to-end data engineering project: raw sales files go in, clean business tables come out, and a dashboard shows the results.

## What it does

1. **Bronze**: loads raw customer, product, and order CSVs as-is, adding load metadata.
2. **Silver**: removes duplicate orders, drops invalid rows (zero or negative quantity, missing customer), and joins in product and region data.
3. **Tests**: runs data-quality checks (unique orders, valid quantities, referential integrity, no missing revenue). If any check fails, the run stops before the gold layer is rebuilt.
4. **Gold**: builds business tables for daily revenue by region and revenue and return rate by category.
5. **Export**: writes the gold tables to `web/data/*.json`, which the Next.js dashboard reads.

The sample data is synthetic and includes deliberate problems (duplicates, negative quantities, missing customers), so the cleaning and test steps have real work to do.

## Project structure

```
ecommerce-analytics/
├── pipeline/
│   ├── generate_data.py      # creates synthetic raw CSVs (bronze inputs)
│   └── run_pipeline.py       # runs bronze -> silver -> tests -> gold -> export
├── sql/
│   ├── silver/               # cleaning models, run in filename order
│   ├── gold/                 # business tables
│   └── tests/                # each file returns the rows that fail a check
├── web/                      # Next.js dashboard (deploy this folder to Vercel)
│   ├── app/
│   │   ├── api/dashboard/route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   └── data/                 # exported JSON (committed so Vercel can serve it)
├── .github/workflows/pipeline.yml
├── requirements.txt
└── README.md
```

## Run it locally

Pipeline (Python 3.11+):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python pipeline/run_pipeline.py
```

Dashboard:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Run the pipeline so `web/data/` is up to date, then commit and push.
2. In Vercel, import the GitHub repository.
3. Set **Root Directory** to `web`.
4. Deploy. No environment variables are needed.

Vercel does not run the pipeline. It serves the JSON exported by the pipeline. To refresh the dashboard, run the pipeline locally, commit `web/data/`, and push.

## Design decisions

- **Layers (bronze, silver, gold)** keep raw data untouched, so any transformation can be rerun from the source files.
- **Tests run before gold is rebuilt**, so bad data never reaches the dashboard.
- **SQL files are plain and ordered by filename**, which keeps the logic easy to read. They map directly onto dbt models if you move to dbt later.
- **Static JSON export** keeps the deployed app free of database hosting and avoids running heavy work on Vercel's serverless functions.

## Next steps

- Move the SQL models into dbt, with its built-in tests and documentation.
- Replace the JSON export with a hosted Postgres database (Neon) so the dashboard can query live tables.
- Add incremental loads, so each run only processes new orders.
- Add Airflow once the basic pipeline is stable.
