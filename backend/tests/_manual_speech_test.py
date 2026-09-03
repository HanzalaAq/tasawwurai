"""Quick functional test for speech parameter extraction (run manually)."""
import asyncio
import sys

sys.path.insert(0, r"c:\Users\HAROON TRADERS\tasawwurai\backend")

from app.ai.mock_provider import (
    MockProvider,
    extract_expression,
    extract_speech_parameters,
)
from app.main import _setup_mock_provider

expr_tests = [
    "plot x squared plus 2x",
    "graph 3 times sine of x",
    "differentiate x cubed minus 2x at x = 2",
    "draw y equals 2x plus 1",
    "show the square root of x",
    "plot x^2 + 2x",
    "natural log of x",
    "exponential growth",
    "show a parabola",
    "explain quantum physics",
    "the mitochondria is the powerhouse of the cell",
    "what is 2 plus 2",
    "2 to the power of x",
    "sine wave with amplitude 3",
]
print("expression extraction:")
for t in expr_tests:
    print(f"  {t[:45]:47s} -> {extract_expression(t)}")

print()
print("end-to-end (keyword match + speech enrichment):")
mp = MockProvider()
_setup_mock_provider(mp)


async def test():
    prompts = [
        'NEW TRANSCRIPT:\n"imagine a projectile launched at 30 degrees with speed 20 on the moon"\nAnalyze the new transcript',
        'NEW TRANSCRIPT:\n"plot x squared plus 2x"\nAnalyze the new transcript',
        'NEW TRANSCRIPT:\n"show me the oxygen atom"\nAnalyze the new transcript',
        'NEW TRANSCRIPT:\n"a 1.5 meter pendulum swinging at 60 degrees"\nAnalyze the new transcript',
        'NEW TRANSCRIPT:\n"quick sort please"\nAnalyze the new transcript',
    ]
    for prompt in prompts:
        r = await mp.complete("sys", prompt, None)
        cmd = r.get("command") or {}
        viz = cmd.get("visualization") or {}
        print(f'  type={viz.get("type"):28s} params={viz.get("parameters")}')


asyncio.run(test())
print()
print("ALL TESTS DONE")
