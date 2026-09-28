"""Single source of truth for timing. Audio and picture both import from here.

96 BPM, 4/4, 6 bars, 24 beats, 15.000 s, 60 fps -> frames 0..899.
"""

BPM = 96
BEAT = 60.0 / BPM            # 0.625 s
BAR = BEAT * 4               # 2.5 s
BARS = 6
DURATION = BAR * BARS        # 15.0 s
FPS = 60
FRAMES = int(round(DURATION * FPS))  # 900
W, H = 1920, 1080
SR = 48000


def beat(n: float) -> float:
    """Time (s) of beat n (0-based, may be fractional)."""
    return n * BEAT


def bar(n: float) -> float:
    return n * BAR


# Section boundaries (bar downbeats) -- the major picture changes land here.
T_OPEN = bar(0)        # 0.000  see the problem
T_TURN = bar(1)        # 2.500  the dot turns
T_BIZ = bar(2)         # 5.000  enter the business
T_LOOP = bar(3)        # 7.500  loop closes, result
T_BRAND = bar(4)       # 10.000 brand
T_END = DURATION       # 15.000

# Secondary, beat-aligned story events (shared by audio & picture).
T_DOT_STOP = beat(2)            # 1.250 dot hits the wall
T_DOT_RETRY = beat(3)           # 1.875 small second attempt
T_KEY_SHIFT = beat(5)           # 3.125 key plate lands in place -> path opens (knock)
T_MODULES = [beat(8), beat(9), beat(10), beat(11)]   # 5.0, 5.625, 6.25, 6.875
T_BRAND_LOCKED = beat(17)       # 10.625 brand fully settled
