"""AI service for content processing, translation, and scoring."""

import json
from typing import Optional
from openai import OpenAI

import sys
sys.path.append("..")
from config import (
    DEEPSEEK_API_KEY,
    OPENAI_API_KEY,
    AI_MODEL_PRIMARY,
    AI_MODEL_FALLBACK,
    MIN_RELEVANCE_SCORE,
)
from sources.base import Article


# AI processing tool definition for structured output
PROCESS_TOOL = {
    "type": "function",
    "function": {
        "name": "process_ev_content",
        "description": "Process EV content and generate structured output with translation and scoring",
        "parameters": {
            "type": "object",
            "properties": {
                "relevance_score": {
                    "type": "integer",
                    "description": "Content value score 0-100 based on: News Value (30pts), Uniqueness (25pts), Timeliness (25pts), Credibility (20pts)"
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Category tags like: BYD, NIO, XPeng, Li Auto, Sales, Technology, Policy, Charging, Battery"
                },
                "translated_title": {
                    "type": "string",
                    "description": "English title - professional and clear"
                },
                "translated_content": {
                    "type": "string",
                    "description": "Full English translation of the content"
                },
                "x_summary": {
                    "type": "string",
                    "description": "X/Twitter post summary - max 250 characters, engaging, includes key facts"
                },
                "hashtags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Recommended hashtags like #ChinaEV, #BYD, etc."
                }
            },
            "required": ["relevance_score", "categories", "translated_title", "x_summary"]
        }
    }
}

SYSTEM_PROMPT = """You are a professional EV industry analyst and translator specializing in Chinese electric vehicle news.

Your task is to process Chinese EV news content and generate:
1. A relevance score (0-100) based on:
   - News Value (30 points): Important announcements, sales data, major events
   - Uniqueness (25 points): Content unique to China, hard to find elsewhere
   - Timeliness (25 points): Current, recent news
   - Credibility (20 points): From reliable official sources

2. Appropriate category tags from: BYD, NIO, XPeng, Li Auto, Zeekr, Xiaomi, Sales, Technology, Policy, Charging, Battery, Autonomous, Export

3. Professional English translation:
   - Use proper EV terminology: NEV (New Energy Vehicle), BEV (Battery EV), PHEV (Plug-in Hybrid)
   - Keep brand names: BYD, NIO, XPeng, Li Auto, Zeekr, Leapmotor
   - Preserve numbers and statistics accurately
   - Natural, professional English suitable for business/investor audience

4. X/Twitter summary (max 250 chars):
   - Lead with the key fact or number
   - Engaging but professional tone
   - Include relevant context for international audience

Be accurate and objective. Do not add information not present in the original."""


class AIService:
    """AI service with provider fallback."""

    def __init__(self):
        self.providers = []

        # Add DeepSeek if available
        if DEEPSEEK_API_KEY:
            self.providers.append({
                "name": "deepseek",
                "client": OpenAI(
                    api_key=DEEPSEEK_API_KEY,
                    base_url="https://api.deepseek.com",
                ),
                "model": AI_MODEL_PRIMARY,
            })

        # Add OpenAI as fallback
        if OPENAI_API_KEY:
            self.providers.append({
                "name": "openai",
                "client": OpenAI(api_key=OPENAI_API_KEY),
                "model": AI_MODEL_FALLBACK,
            })

        if not self.providers:
            raise ValueError("No AI providers configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY.")

    def process_content(self, title: str, content: str, source: str) -> Optional[dict]:
        """Process content through AI to get translation and scoring."""
        user_prompt = f"""Process this EV news content:

Source: {source}
Title: {title}
Content:
{content[:4000]}  # Limit content length
"""

        for provider in self.providers:
            try:
                response = provider["client"].chat.completions.create(
                    model=provider["model"],
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    tools=[PROCESS_TOOL],
                    tool_choice={"type": "function", "function": {"name": "process_ev_content"}},
                    temperature=0.3,
                    max_tokens=2000,
                )

                # Extract function call result
                if response.choices[0].message.tool_calls:
                    tool_call = response.choices[0].message.tool_calls[0]
                    result = json.loads(tool_call.function.arguments)
                    print(f"[{provider['name']}] Processed: {title[:50]}... Score: {result.get('relevance_score', 0)}")
                    return result

            except Exception as e:
                print(f"[{provider['name']}] Error: {e}")
                continue

        print(f"All AI providers failed for: {title[:50]}...")
        return None


def process_article(article: Article, ai_service: AIService) -> Optional[Article]:
    """Process an article through AI and update its fields.

    Returns:
        Updated Article if successful and meets minimum score, None otherwise.
    """
    result = ai_service.process_content(
        title=article.original_title or "",
        content=article.original_content,
        source=article.source_author,
    )

    if not result:
        return None

    # Check minimum relevance score
    score = result.get("relevance_score", 0)
    if score < MIN_RELEVANCE_SCORE:
        print(f"Skipping low-score article ({score}): {article.original_title[:50]}...")
        return None

    # Update article with AI results
    article.relevance_score = score
    article.categories = result.get("categories", [article.source_author])
    article.translated_title = result.get("translated_title")
    article.translated_content = result.get("translated_content")
    article.translated_summary = result.get("x_summary", "")[:280]  # Ensure max length

    # Add hashtags to categories if not present
    hashtags = result.get("hashtags", [])
    for tag in hashtags:
        clean_tag = tag.lstrip("#")
        if clean_tag not in article.categories:
            article.categories.append(clean_tag)

    return article
