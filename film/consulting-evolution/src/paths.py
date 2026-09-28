import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "output")
WORK = os.path.join(OUTPUT, "work")
CACHE = os.path.join(ROOT, ".cache")


def load_config():
    with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as fh:
        return json.load(fh)


def asset(rel):
    return rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
