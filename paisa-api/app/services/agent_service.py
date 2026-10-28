"""The agent loop.

Ask the model a question with the tools attached. If it asks for a tool,
run it and hand the result back. Repeat until it answers in words or the
step cap stops it.

Every step is written to agent_steps. A wrong number can then be traced
to the tool call that produced it, instead of guessed at.
"""

import json
import logging
import time

from beanie import PydanticObjectId

from app.db.models import AgentRun, AgentStep
from app.services.llm import chat_with_tools
from app.services.tools import TOOL_SCHEMAS, run_tool

logger = logging.getLogger("paisa")

# Eight tool calls is more than any question here needs. Without a cap a
# model that keeps re-querying the same month runs until the context
# fills, which costs money and returns nothing.
MAX_STEPS = 8

SYSTEM = """You answer questions about one person's UPI spending.

Every number you give must come from a tool result. Never add up amounts
yourself and never estimate — if you need a total, there is a tool for it.

The statement covers a fixed set of months. When the question says "last
month" or "recently", call list_months first to find out which months
exist; do not assume the current date.

Amounts from tools are already in rupees. Quote them as given.

If a tool returns an error, read it, fix the call and try again.

Answer in two or three sentences. State the number, then the one thing
that explains it. No preamble."""


async def ask(user_id: PydanticObjectId, question: str) -> dict:
    run = AgentRun(user_id=user_id, question=question)
    await run.insert()

    messages: list[dict] = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": question},
    ]

    started = time.perf_counter()
    tokens = 0
    step_no = 0
    answer = None

    while step_no < MAX_STEPS:
        step_no += 1
        reply, usage = await chat_with_tools(messages, TOOL_SCHEMAS)
        tokens += usage

        calls = reply.tool_calls or []

        if not calls:
            answer = reply.content
            await AgentStep(
                run_id=run.id,
                step_no=step_no,
                kind="answer",
                tool_name=None,
                arguments=None,
                result={"text": answer},
                duration_ms=0,
            ).insert()
            break

        # The whole assistant message goes back, tool_calls included.
        # Sending only the text loses the ids the tool results refer to
        # and the next request is rejected.
        messages.append(reply.model_dump(exclude_none=True))

        for call in calls:
            name = call.function.name
            step_started = time.perf_counter()

            try:
                arguments = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError as exc:
                arguments = {}
                result = {"error": f"Arguments were not valid JSON: {exc}"}
            else:
                result = await run_tool(user_id, name, arguments)

            elapsed = int((time.perf_counter() - step_started) * 1000)
            failed = isinstance(result, dict) and "error" in result

            await AgentStep(
                run_id=run.id,
                step_no=step_no,
                kind="retry" if failed else "tool",
                tool_name=name,
                arguments=arguments,
                result=result,
                duration_ms=elapsed,
            ).insert()

            logger.info(
                "agent_tool run=%s step=%s name=%s ok=%s %sms",
                run.id, step_no, name, not failed, elapsed,
            )

            # The result goes back as a tool message, errors included.
            # An error the model can read is an error it can correct.
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result),
                }
            )

    if answer is None:
        answer = (
            "I could not answer that within the step limit. "
            "Try asking about one month or one payee at a time."
        )
        logger.warning("agent_hit_cap run=%s", run.id)

    run.answer = answer
    run.steps = step_no
    run.tokens = tokens
    run.duration_ms = int((time.perf_counter() - started) * 1000)
    await run.save()

    return {
        "run_id": str(run.id),
        "answer": answer,
        "steps": step_no,
        "tokens": tokens,
        "duration_ms": run.duration_ms,
    }


async def get_trace(user_id: PydanticObjectId, run_id: PydanticObjectId) -> dict:
    run = await AgentRun.get(run_id)
    if run is None or run.user_id != user_id:
        return {}

    steps = (
        await AgentStep.find(AgentStep.run_id == run.id)
        .sort(AgentStep.step_no, AgentStep.id)
        .to_list()
    )
    return {
        "run_id": str(run.id),
        "question": run.question,
        "answer": run.answer,
        "steps": run.steps,
        "tokens": run.tokens,
        "duration_ms": run.duration_ms,
        "trace": [
            {
                "step_no": s.step_no,
                "kind": s.kind,
                "tool_name": s.tool_name,
                "arguments": s.arguments,
                "result": s.result,
                "duration_ms": s.duration_ms,
            }
            for s in steps
        ],
    }
