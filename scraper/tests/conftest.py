"""Shared test fixtures for scraper tests."""

import sys
import os

# Add scraper root to path so extractors can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
