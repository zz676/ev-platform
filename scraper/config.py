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

# Scraper Settings
SCRAPE_INTERVAL_HOURS = int(os.getenv("SCRAPE_INTERVAL_HOURS", "6"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Data Sources
SOURCES = {
    "nio": {
        "name": "NIO",
        "ir_url": "https://ir.nio.com/news-events/press-releases",
        "enabled": True,
    },
    "xpeng": {
        "name": "XPeng",
        "ir_url": "https://ir.xiaopeng.com/news-releases",
        "enabled": True,
    },
    "li_auto": {
        "name": "Li Auto",
        "ir_url": "https://ir.lixiang.com/news-releases",
        "enabled": True,
    },
    "byd": {
        "name": "BYD",
        "news_url": "https://www.byd.com/en/news",
        "enabled": True,
    },
    "zeekr": {
        "name": "Zeekr",
        "ir_url": "https://ir.zeekr.com/news-releases",
        "enabled": True,
    },
    "leapmotor": {
        "name": "Leapmotor",
        "ir_url": "https://ir.leapmotor.com/",
        "enabled": False,  # Needs implementation
    },
}

# AI Processing Settings
MIN_RELEVANCE_SCORE = 40  # Minimum score to keep content
AI_MODEL_PRIMARY = "deepseek-chat"
AI_MODEL_FALLBACK = "gpt-4o-mini"
