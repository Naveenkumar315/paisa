import json
import logging

from openai import AsyncAzureOpenAI

from app.core.config import settings

logger = logging.getLogger("paisa")

_client = AsyncAzureOpenAI(
    azure_endpoint=settings.azure_openai_endpoint,
    api_key=settings.azure_openai_api_key,
    api_version=settings.azure_api_version,
    max_retries=3,
)


async def complete_json(prompt: str) -> dict:
    """Ask the model for JSON and parse it.

    response_format forces valid JSON at the API level, so there are no
    code fences to strip and no half-sentence before the bracket. It only
    returns an object, never a bare array — so prompts ask for a wrapper
    key and the caller reaches inside.
    """
    response = await _client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )

    usage = response.usage
    logger.info(
        "llm_call prompt_tokens=%s completion_tokens=%s",
        usage.prompt_tokens if usage else "?",
        usage.completion_tokens if usage else "?",
    )

    return json.loads(response.choices[0].message.content)


async def chat_with_tools(messages: list[dict], tools: list[dict]):
    """One turn with tools attached. Returns the message and token count."""
    response = await _client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=messages,
        tools=tools,
        temperature=0,
    )
    usage = response.usage.total_tokens if response.usage else 0
    return response.choices[0].message, usage
