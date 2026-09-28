from .base import REGISTRY

_LOADED = False


def load_all():
    global _LOADED
    if _LOADED:
        return
    from . import ch00, ch01, ch02, ch03, ch04, ch05, ch06, ch07  # noqa: F401  注册各章镜头
    _LOADED = True
