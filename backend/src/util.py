import logging

logging.basicConfig(level = logging.INFO)
logger = logging.getLogger("asyncio")

async def do_nothing() -> None:
    """A coroutine that does nothing."""
    pass

