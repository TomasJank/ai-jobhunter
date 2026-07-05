#!/usr/bin/env python3
"""Thin JobSpy bridge: fetch one board, print JSON records to stdout.
Usage: jobspy_fetch.py <site> <search_term> [results_wanted] [location]"""
import sys, json

from jobspy import scrape_jobs

site = sys.argv[1]
term = sys.argv[2]
wanted = int(sys.argv[3]) if len(sys.argv) > 3 else 15
location = sys.argv[4] if len(sys.argv) > 4 else None

df = scrape_jobs(
    site_name=[site],
    search_term=term,
    google_search_term=f"{term} jobs" if site == "google" else None,
    location=location,
    results_wanted=wanted,
    hours_old=168,  # past week; seen.json dedupes across runs anyway
)
cols = [c for c in ("title", "company", "location", "job_url", "date_posted",
                    "description", "min_amount", "max_amount", "currency", "interval",
                    "is_remote", "job_type") if c in df.columns]
print(df[cols].to_json(orient="records", date_format="iso"))
