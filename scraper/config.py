"""Configuration for the EV Platform scraper."""

import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Supabase
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Webhook
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "http://localhost:3000/api/webhook")
WEBHOOK_SECRET = os.getenv("SCRAPER_WEBHOOK_SECRET")
CRON_SECRET = os.getenv("CRON_SECRET")  # For triggering X publish

# API Base URL (for industry data tables)
# Derives from WEBHOOK_URL by default, can be overridden
API_BASE_URL = os.getenv("API_BASE_URL", WEBHOOK_URL.replace("/api/webhook", ""))

# Scraper Settings
SCRAPE_INTERVAL_HOURS = int(os.getenv("SCRAPE_INTERVAL_HOURS", "6"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Data Sources
SOURCES = {
    "nio": {
        "name": "NIO",
        "news_url": "https://www.nio.com/news",
        "enabled": True,
    },
    "xpeng": {
        "name": "XPeng",
        "ir_url": "https://ir.xiaopeng.com/",
        "enabled": True,
    },
    "li_auto": {
        "name": "Li Auto",
        "ir_url": "https://ir.lixiang.com/",
        "enabled": True,
    },
    "byd": {
        "name": "BYD",
        "news_url": "https://www.byd.com/cn/news",
        "enabled": False,  # Vue.js client-side rendering requires Playwright
    },
    "zeekr": {
        "name": "Zeekr",
        "ir_url": "https://ir.zeekr.com/news-releases",
        "enabled": False,  # Not implemented yet
    },
    "leapmotor": {
        "name": "Leapmotor",
        "ir_url": "https://ir.leapmotor.com/",
        "enabled": False,  # Needs implementation
    },
    "weibo": {
        "name": "Weibo",
        "enabled": True,
    },
}

# AI Processing Settings
MIN_RELEVANCE_SCORE = 40  # Minimum score to keep content
AI_MODEL_PRIMARY = "deepseek-chat"
AI_MODEL_FALLBACK = "gpt-4o-mini"

# CnEVData Scraper Settings
CNEVDATA_CONFIG = {
    "name": "CnEVData",
    "base_url": "https://cnevdata.com",
    "enabled": True,

    # User Agent rotation pool
    "user_agents": [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ],

    # Request interval (randomized for anti-detection)
    "min_delay": 3,      # Minimum delay seconds between requests
    "max_delay": 8,      # Maximum delay seconds between requests

    # Request headers
    "headers": {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    },

    # Rate limiting
    "weekly_limit": 100,  # Max articles per week
}

# Backfill Configuration
BACKFILL_CONFIG = {
    "total_pages": 120,
    "batch_size": 10,           # Pages per batch (increased from 5)
    "batch_delay": 60,          # 1 minute between batches (reduced from 30 min)
    "page_delay": (3, 8),       # 3-8 seconds random between pages (reduced from 8-20)
    "article_delay": (1, 3),    # 1-3 seconds between articles (reduced from 3-8)
    "max_retries": 3,
    "resume_from_last": True,   # Support checkpoint resume
    "ocr_concurrency": 5,       # Parallel OCR limit
}
