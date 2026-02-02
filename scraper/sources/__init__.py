"""Source adapters for different EV news sources."""

from .base import BaseSource, Article
from .nio import NIOSource
from .xpeng import XPengSource
from .li_auto import LiAutoSource
from .byd import BYDSource
from .weibo import WeiboSource

__all__ = [
    "BaseSource",
    "Article",
    "NIOSource",
    "XPengSource",
    "LiAutoSource",
    "BYDSource",
    "WeiboSource",
]
