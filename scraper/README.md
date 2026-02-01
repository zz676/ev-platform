# EV Platform Scraper

Python-based scraper for collecting Chinese EV news from official company websites.

## Setup

### 1. Create virtual environment

```bash
cd scraper
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Create a `.env` file in the scraper directory:

```env
# AI APIs
DEEPSEEK_API_KEY=sk-xxx  # Primary (recommended - better Chinese)
OPENAI_API_KEY=sk-xxx    # Fallback

# Webhook
WEBHOOK_URL=http://localhost:3000/api/webhook
SCRAPER_WEBHOOK_SECRET=your-secret-here

# Optional
SCRAPE_INTERVAL_HOURS=6
```

## Usage

### Run once (all enabled sources)

```bash
python main.py
```

### Run specific sources

```bash
python main.py --sources nio byd
```

### Testing (dry run, no webhook)

```bash
python main.py --dry-run
```

### Testing (skip AI processing)

```bash
python main.py --skip-ai --dry-run
```

### Run with scheduler (periodic)

```bash
python scheduler.py
```

## Available Sources

| Source | Name | Status |
|--------|------|--------|
| `nio` | NIO (蔚来) | ✅ Enabled |
| `xpeng` | XPeng (小鹏) | ✅ Enabled |
| `li_auto` | Li Auto (理想) | ✅ Enabled |
| `byd` | BYD (比亚迪) | ✅ Enabled |
| `zeekr` | Zeekr (极氪) | ✅ Enabled |

## Adding New Sources

1. Create a new file in `sources/` (e.g., `sources/zeekr.py`)
2. Inherit from `BaseSource` and implement `fetch_articles()`
3. Add to `sources/__init__.py`
4. Add to `SOURCE_CLASSES` in `main.py`
5. Add configuration in `config.py`

Example:

```python
from .base import BaseSource, Article

class NewSource(BaseSource):
    name = "NewBrand"
    source_type = "OFFICIAL"
    news_url = "https://example.com/news"

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        # Implement scraping logic
        pass
```

## Deployment (Railway)

1. Create a new Railway project
2. Connect this repository
3. Set environment variables in Railway dashboard
4. Deploy

The scheduler will run automatically and scrape every N hours (configurable).

## Project Structure

```
scraper/
├── sources/           # Source adapters
│   ├── __init__.py
│   ├── base.py       # Base class for all sources
│   ├── nio.py        # NIO scraper
│   ├── xpeng.py      # XPeng scraper
│   ├── li_auto.py    # Li Auto scraper
│   └── byd.py        # BYD scraper
├── processors/        # AI processing
│   ├── __init__.py
│   └── ai_service.py # DeepSeek/OpenAI integration
├── config.py         # Configuration
├── main.py           # CLI entry point
├── scheduler.py      # Periodic scheduler
├── requirements.txt  # Python dependencies
└── README.md
```
