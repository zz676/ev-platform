"""Shared test fixtures for scraper tests."""

import sys
import os
import time

import pytest

# Add scraper root to path so extractors can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from extractors.classifier import ArticleClassifier
from extractors.industry_extractor import IndustryDataExtractor
from extractors.title_parser import TitleParser


@pytest.fixture(scope="session")
def classifier():
    """Shared ArticleClassifier instance."""
    return ArticleClassifier()


@pytest.fixture(scope="session")
def extractor():
    """Shared IndustryDataExtractor instance."""
    return IndustryDataExtractor()


@pytest.fixture(scope="session")
def title_parser():
    """Shared TitleParser instance."""
    return TitleParser()


@pytest.fixture(scope="module")
def cnevdata_source():
    """Shared CnEVDataSource instance. Only created for integration tests."""
    from sources.cnevdata import CnEVDataSource
    source = CnEVDataSource()
    yield source
    source.close()


@pytest.fixture(scope="module")
def page_1_articles(cnevdata_source):
    """Cached page 1 fetch result. Only fetched once per module."""
    articles = cnevdata_source.fetch_article_list(page=1)
    return articles


@pytest.fixture(scope="module")
def page_2_articles(cnevdata_source):
    """Cached page 2 fetch result with rate-limiting delay."""
    time.sleep(5)
    articles = cnevdata_source.fetch_article_list(page=2)
    return articles
