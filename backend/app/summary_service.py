import os
import re

from app.config import get_settings


def fallback_summary(title: str, content: str) -> str:
    text = re.sub(r"```.*?```", " ", content, flags=re.DOTALL)
    text = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", text)
    text = re.sub(r"\[[^\]]+]\([^)]+\)", " ", text)
    text = re.sub(r"[*_`>#-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return f"{title}에 대한 개발 공부 기록입니다." if title else "개발 공부 기록입니다."
    return text[:150] + ("..." if len(text) > 150 else "")


async def summarize_markdown(title: str, content: str) -> str:
    settings = get_settings()
    if not settings.ai_api_key or not settings.ai_model:
        return fallback_summary(title, content)

    os.environ.setdefault("OPENAI_API_KEY", settings.ai_api_key)
    os.environ.setdefault("ANTHROPIC_API_KEY", settings.ai_api_key)
    os.environ.setdefault("GEMINI_API_KEY", settings.ai_api_key)

    prompt = (
        "아래 Markdown 글을 블로그 카드에 들어갈 한국어 요약으로 1~2문장만 작성해줘. "
        "과장하지 말고 핵심 학습 내용을 짧게 설명해.\n\n"
        f"제목: {title}\n\n본문:\n{content[:6000]}"
    )

    try:
        from pydantic_ai import Agent

        agent = Agent(settings.ai_model)
        result = await agent.run(prompt)
        summary = getattr(result, "output", None) or getattr(result, "data", None) or str(result)
        summary = str(summary).strip()
        return summary[:240] if summary else fallback_summary(title, content)
    except Exception:
        return fallback_summary(title, content)
