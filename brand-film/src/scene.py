"""《一线破局》 — the whole film as one continuous world, driven by time t (s).

Plan units: U = 60 world units (one module). X right, Z forward, Y up.
  Dark hall  : Z < 9.0 U   graphite plates on a graphite floor
  End wall   : 9.0 .. 9.5 U, a one-module slit at X = 2 U
  Ivory hall : Z > 9.5 U   ivory paper model — the business

One vermilion line runs through all of it (LINE). Every major change is
anchored to the beat grid in timeline.py.
"""
import math

import numpy as np
import skia

import easing as ez
import engine3d
from easing import remap, lerp, clamp, seg
from engine3d import (GRAPHITE as G, IVORY as I, VERMILION as R, mix, paint, sk,
                      Camera, Box, Style, FloorPath, sort_boxes, draw_box, draw_shadow,
                      draw_poly3d, draw_line3d, floor_poly, ribbon_polygon,
                      poly_path, clip_near, draw_floor_shader)
from timeline import (W, H, BEAT, T_TURN, T_BIZ, T_LOOP, T_BRAND, T_KEY_SHIFT,
                      T_DOT_STOP, T_DOT_RETRY, T_MODULES)
from typography import Line

U = 60.0
Z_WALL0, Z_WALL1 = 9.0 * U, 9.5 * U
SLIT_X0, SLIT_X1 = 1.5 * U, 2.5 * U
SLIT_H = 2.5 * U
WALL_TOP = 16.0 * U

# ======================================================================= materials
FOG_DARK = (G, 700.0, 2300.0, 0.72)
AO_DARK = G * 0.55
WALL = Style(lit=mix(G, I, 0.12), unlit=mix(G, I, 0.025), top=mix(G, I, 0.19),
             edge=I, edge_alpha=0.30, edge_w=1.15, edges='top', fog=FOG_DARK,
             ao=0.8, ao_col=AO_DARK, pool=0.10)
WALL_TALL = Style(lit=mix(G, I, 0.105), unlit=mix(G, I, 0.02), top=mix(G, I, 0.18),
                  edge=I, edge_alpha=0.32, edge_w=1.2, edges='top', fog=FOG_DARK,
                  ao=0.8, ao_col=AO_DARK, pool=0.10)
KEY = Style(lit=mix(G, I, 0.15), unlit=mix(G, I, 0.035), top=mix(G, I, 0.24),
            edge=I, edge_alpha=0.48, edge_w=1.3, edges='top', fog=FOG_DARK,
            ao=0.7, ao_col=AO_DARK, pool=0.10)
SLAB = Style(lit=mix(G, I, 0.10), unlit=mix(G, I, 0.03), top=mix(G, I, 0.15),
             edge=I, edge_alpha=0.24, edge_w=1.0, edges='rim', fog=FOG_DARK, pool=0.08)
WIRE = Style(lit=G, unlit=G, edge=I, edge_alpha=0.16, edge_w=1.0, edges='all', wire=True,
             fog=FOG_DARK)
PANEL = Style(lit=mix(G, I, 0.085), unlit=mix(G, I, 0.05), top=mix(G, I, 0.2),
              edge=I, edge_alpha=0.30, edge_w=1.0, edges='rim')
END_FACE = mix(G, I, 0.045)
END_SIDE_L = mix(G, I, 0.10)
END_SIDE_R = mix(G, I, 0.03)
END_UNDER = mix(G, I, 0.02)

IV_AO = mix(I, G, 0.22)
IV_MOD = Style(lit=I, unlit=mix(I, G, 0.17), top=mix(I, G, 0.012), edge=G, edge_alpha=0.34,
               edge_w=1.0, edges='rim', ao=0.55, ao_col=IV_AO)
IV_MOD_SOFT = Style(lit=I, unlit=mix(I, G, 0.13), top=mix(I, G, 0.02), edge=G, edge_alpha=0.22,
                    edge_w=1.0, edges='top', ao=0.45, ao_col=IV_AO)
IV_UNIT = Style(lit=mix(G, I, 0.36), unlit=mix(G, I, 0.06), top=mix(G, I, 0.24), edge=None)
IV_WIRE = Style(lit=I, unlit=I, edge=G, edge_alpha=0.18, edge_w=1.0, edges='all', wire=True)


def ub(x0, z0, x1, z1, h, y0=0.0):
    """Box from plan coordinates in modules."""
    return (np.array([x0 * U, y0 * U, z0 * U]), np.array([x1 * U, (y0 + h) * U, z1 * U]))


# ======================================================================= the dark hall
# Lane A (dot's lane): X in [-0.75, 0.75], blocked by B1 at Z = 5.6
# Cutout           : gap in lane A's right wall, Z in [4.8, 5.6] (hidden under canopy C1)
# Route B          : X = 2.0, up to the slit in the end wall
# K                : tall screen wall (影壁) right in front of the slit; its true place
#                    is two modules to the right (drafting outline on the floor)
DARK_STATIC = [
    ('LA', ub(-0.95, 1.0, -0.75, 5.8, 1.0), WALL),
    ('RA1', ub(0.75, 1.6, 0.95, 4.8, 1.0), WALL),
    ('B1', ub(-0.75, 5.6, 0.75, 5.8, 1.0), WALL),
    ('RA2', ub(0.75, 5.6, 0.95, 7.4, 1.0), WALL),
    ('RB', ub(2.95, 5.9, 3.15, 7.5, 1.2), WALL),
    ('W1', ub(-5.0, 7.0, -1.8, 7.2, 1.6), WALL_TALL),
    ('W2', ub(-3.2, 1.5, -3.0, 8.5, 1.2), WALL),
    ('W3', ub(4.0, 3.2, 7.6, 3.4, 0.8), WALL),
    ('W4', ub(5.4, 4.4, 5.6, 8.4, 2.2), WALL_TALL),
    ('W6', ub(-1.8, 7.6, 0.75, 7.8, 1.0), WALL),
    ('P2', ub(3.6, 0.5, 7.2, 2.8, 0.05), SLAB),
    ('C1', ub(3.4, 4.9, 5.3, 6.9, 0.1, y0=1.55), SLAB),
    ('C2', ub(-5.2, 7.6, -1.2, 8.8, 0.1, y0=2.4), SLAB),
    ('F1', ub(-5.0, 7.4, -2.0, 8.9, 3.0), WIRE),
    ('F2', ub(4.0, 4.6, 7.5, 8.6, 3.6), WIRE),
    ('F3', ub(-1.6, 0.2, 1.6, 1.4, 0.01), WIRE),
]
K_SHIFT_T0 = T_KEY_SHIFT - 0.23   # the line arrives, then K moves — decisively


def key_offset(t):
    return seg(t, [(K_SHIFT_T0, T_KEY_SHIFT, 0.0, 2.0 * U, ez.precise)], 0.0)


FIELD_W, FIELD_H = 5.4, 1.3
FIELD_A = (-0.7, 2.95)     # 找到新路 — above the slit
FIELD_B = (4.9, 2.95)      # 看清变局
_TXT = {}


def txt(key):
    if key not in _TXT:
        spec = {
            'A': ('找到新路', 'SemiBold', 0.94 * U, 0.30),
            'B': ('看清变局', 'SemiBold', 0.94 * U, 0.30),
            'core': ('把 AI，变成生意。', 'Bold', 112, 0.05),
            'brand': ('贺去病商业咨询', 'SemiBold', 136, 0.14),
            'slogan': ('懂生意，能落地。', 'Regular', 54, 0.36),
        }[key]
        _TXT[key] = Line(spec[0], spec[1], spec[2], tracking=spec[3])
    return _TXT[key]


def panel_x(t):
    """Two sliding leaves in front of the plaque fields (modules)."""
    p2 = seg(t, [(0.26, 1.10, 4.8, 10.6, ez.heavy)], 4.8)                         # reveals 看清变局
    p1 = seg(t, [(K_SHIFT_T0, T_KEY_SHIFT, -0.8, 4.8, ez.precise)], -0.8)          # reveals 找到新路
    return p1, p2


def dark_boxes(t):
    out = [Box(lo, hi, st, name=name) for name, (lo, hi), st in DARK_STATIC]
    k = key_offset(t)
    lo, hi = ub(1.0, 7.8, 3.0, 8.0, 3.0)
    out.append(Box(lo + [k, 0, 0], hi + [k, 0, 0], KEY, name='K'))
    p1, p2 = panel_x(t)
    for px, nm in ((p1, 'P_1'), (p2, 'P_2')):
        lo, hi = ub(px, 8.8, px + FIELD_W + 0.2, 8.92, FIELD_H + 0.2, y0=FIELD_A[1] - 0.1)
        out.append(Box(lo, hi, PANEL, name=nm))
    return out


def draw_end_wall(canvas, cam):
    """The end wall as one plane with a real aperture (no seams), plus the slit's
    three inner faces, plus the two plaque inscriptions."""
    z = Z_WALL0
    outer = np.array([[-60 * U, 0, z], [60 * U, 0, z], [60 * U, WALL_TOP, z], [-60 * U, WALL_TOP, z]])
    hole = np.array([[SLIT_X0, 0, z], [SLIT_X0, SLIT_H, z], [SLIT_X1, SLIT_H, z], [SLIT_X1, 0, z]])
    if cam.pos[2] < z:
        path = skia.Path()
        path.setFillType(skia.PathFillType.kEvenOdd)
        for poly in (outer, hole):
            Pc = clip_near(cam.to_cam(poly), cam.near)
            if len(Pc) >= 3:
                path.addPath(poly_path(cam.proj(Pc)))
        # faint vertical light spill from the pool below
        p = paint(END_FACE)
        base = cam.to_cam(np.array([[1.5 * U, 0, z], [1.5 * U, 4.0 * U, z]]))
        if (base[:, 2] > cam.near).all():
            sp = cam.proj(base)
            sh = skia.GradientShader.MakeLinear([skia.Point(*sp[0]), skia.Point(*sp[1])],
                                                [sk(mix(G, I, 0.085)).toColor(), sk(END_FACE).toColor()])
            p.setShader(sh)
        canvas.drawPath(path, p)
        for key, (fx, fy) in (('A', FIELD_A), ('B', FIELD_B)):
            draw_inscription(canvas, cam, txt(key), fx * U, fy * U, FIELD_W * U, FIELD_H * U, z - 0.2)
    # inner faces of the slit
    z0, z1 = Z_WALL0, Z_WALL1
    if cam.pos[0] > SLIT_X0:
        draw_poly3d(canvas, cam, np.array([[SLIT_X0, 0, z0], [SLIT_X0, 0, z1], [SLIT_X0, SLIT_H, z1],
                                           [SLIT_X0, SLIT_H, z0]]), paint(END_SIDE_L))
    if cam.pos[0] < SLIT_X1:
        draw_poly3d(canvas, cam, np.array([[SLIT_X1, 0, z0], [SLIT_X1, 0, z1], [SLIT_X1, SLIT_H, z1],
                                           [SLIT_X1, SLIT_H, z0]]), paint(END_SIDE_R))
    if cam.pos[1] < SLIT_H:
        draw_poly3d(canvas, cam, np.array([[SLIT_X0, SLIT_H, z0], [SLIT_X1, SLIT_H, z0],
                                           [SLIT_X1, SLIT_H, z1], [SLIT_X0, SLIT_H, z1]]), paint(END_UNDER))


def draw_inscription(canvas, cam, line, x0, y0, w, h, z):
    """Set into the wall, but kept upright: position and scale follow the wall,
    verticals stay vertical (type must never lean)."""
    c = np.array([[x0 + w / 2, y0 + h / 2, z], [x0 + w / 2 + 1.0, y0 + h / 2, z]])
    Pc = cam.to_cam(c)
    if (Pc[:, 2] < cam.near * 3).any():
        return
    sp = cam.proj(Pc)
    k = float(np.linalg.norm(sp[1] - sp[0]))
    canvas.save()
    canvas.translate(float(sp[0][0]), float(sp[0][1]))
    canvas.scale(k, k)
    ox, oy = line.origin_for_center(0.0, 0.0)
    line.draw(canvas, ox, oy, paint(I, 0.95))
    canvas.restore()


def draw_decals_dark(canvas, cam, t):
    # the existing path: a fine groove down lane A
    pe = paint(I, 0.20, stroke=1.0)
    for dx in (-0.09 * U, 0.09 * U):
        draw_line3d(canvas, cam, (dx, 0.1, DOT_START[1] - 0.3 * U), (dx, 0.1, 5.6 * U), pe)
    # drafting outline of K's true place (dashed rectangle on the floor)
    a = 0.36 * (1 - 0.7 * ez.smoothstep(remap(t, T_KEY_SHIFT, T_KEY_SHIFT + 0.4)))
    dashed_rect(canvas, cam, 3.0 * U, 7.8 * U, 5.0 * U, 8.0 * U, paint(I, a, stroke=1.0))


def dashed_rect(canvas, cam, x0, z0, x1, z1, pnt, dash=9.0):
    rect = [(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)]
    for (ax, az), (bx, bz) in zip(rect[:-1], rect[1:]):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, int(L / dash))
        for i in range(0, n, 2):
            a, b = i / n, min(1, (i + 1) / n)
            draw_line3d(canvas, cam, (ax + (bx - ax) * a, 0.1, az + (bz - az) * a),
                        (ax + (bx - ax) * b, 0.1, az + (bz - az) * b), pnt)


# ======================================================================= the line
DOT_START = (0.0, 1.3 * U)
DOT_STOP = (0.0, 5.44 * U)
LOOP_X0, LOOP_X1, LOOP_Z0, LOOP_Z1 = -2.0 * U, 6.0 * U, 17.0 * U, 21.0 * U
LOOP_C = ((LOOP_X0 + LOOP_X1) / 2, (LOOP_Z0 + LOOP_Z1) / 2)     # (2U, 19U)
R_JOIN = 0.3 * U
R_LOOP = 0.45 * U
LINE = FloorPath([
    DOT_STOP,
    (2.0 * U, 5.44 * U),                  # through the cutout into route B
    (2.0 * U, LOOP_Z0),                   # through the slit, into the business
    (LOOP_X0, LOOP_Z0), (LOOP_X0, LOOP_Z1), (LOOP_X1, LOOP_Z1), (LOOP_X1, LOOP_Z0),
    (2.0 * U - R_JOIN, LOOP_Z0),          # closes onto its own start
], radius=[0.5 * U, R_JOIN, R_LOOP, R_LOOP, R_LOOP, R_LOOP])
S_WAIT = LINE.nearest((2.0 * U, 6.55 * U))           # waits before K
S_WALL = LINE.nearest((2.0 * U, Z_WALL1))
S_LOOP0 = LINE.nearest((2.0 * U - R_JOIN, LOOP_Z0))  # enters the loop (M1)
S_END = LINE.length                                  # loop closed
LOOP_LEN = S_END - S_LOOP0
V_LOOP = LOOP_LEN / (T_LOOP - T_BIZ)


def dot_z(t):
    z0, z1 = DOT_START[1], DOT_STOP[1]
    if t < 0.10:
        return z0
    if t < T_DOT_STOP:
        return lerp(z0, z1, ez.cubic_bezier(0.40, 0.0, 0.10, 1.0)(remap(t, 0.10, T_DOT_STOP)))
    if T_DOT_RETRY - 0.06 < t < T_DOT_RETRY + 0.5:          # a second, smaller attempt
        k = remap(t, T_DOT_RETRY - 0.06, T_DOT_RETRY + 0.5)
        return z1 - 0.10 * U * math.sin(math.pi * ez.cubic_bezier(0.3, 0, 0.3, 1)(k)) * (1 - k)
    return z1


def head_s(t):
    """Arc length of the line's head along LINE."""
    if t < T_TURN:
        return 0.0
    if t < K_SHIFT_T0 + 0.02:
        return lerp(0.0, S_WAIT, ez.cubic_bezier(0.25, 0.0, 0.12, 1.0)(remap(t, T_TURN, K_SHIFT_T0 + 0.02)))
    if t < T_KEY_SHIFT:
        return S_WAIT
    if t < T_BIZ:
        # cubic Hermite: rest at the key, arrives at the loop with loop speed
        T = T_BIZ - T_KEY_SHIFT
        u = (t - T_KEY_SHIFT) / T
        p0, p1, m0, m1 = S_WAIT, S_LOOP0, 0.0, V_LOOP * T
        h00, h10 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u
        h01, h11 = -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1
    if t < T_LOOP:
        return S_LOOP0 + V_LOOP * (t - T_BIZ)
    return S_END


def tail_s(t):
    """The lead-in retracts into the loop once the loop is closed."""
    return seg(t, [(T_LOOP + 0.30, T_LOOP + 1.20, 0.0, S_LOOP0, ez.standard)], 0.0)


def line_width(t):
    w_dark, w_biz = 0.22 * U, 0.115 * U
    return seg(t, [(3.30, 4.40, w_dark, w_biz, ez.gentle)], w_dark)


def draw_ribbon(canvas, cam, s0, s1, w, halo=0.0):
    if s1 - s0 < 0.5:
        return
    poly = ribbon_polygon(LINE, s0, s1, w, head_round=True, tail_round=True)
    if halo > 0:
        draw_poly3d(canvas, cam, poly, paint(R, halo, blur=6.0))
    draw_poly3d(canvas, cam, poly, paint(R, 1.0))


def draw_dot(canvas, cam, t, w):
    p = (0.0, dot_z(t))
    path = FloorPath([p, (p[0] + 1, p[1])])
    poly = ribbon_polygon(path, 0, 0, w)
    draw_poly3d(canvas, cam, poly, paint(R, 0.28, blur=7.0))
    draw_poly3d(canvas, cam, poly, paint(R, 1.0))


# ======================================================================= the ivory hall
def loop_point(ell):
    """Point/direction on the closed loop, ell measured from S_LOOP0."""
    return LINE.at(S_LOOP0 + (ell % LOOP_LEN))


def outward(p):
    """Unit normal pointing away from the loop centre (plan)."""
    d = np.array([p[0] - LOOP_C[0], p[1] - LOOP_C[1]])
    hx, hz = (LOOP_X1 - LOOP_X0) / 2, (LOOP_Z1 - LOOP_Z0) / 2
    if abs(d[0]) / hx > abs(d[1]) / hz:
        return np.array([math.copysign(1, d[0]), 0.0])
    return np.array([0.0, math.copysign(1, d[1])])


# module anchor = where the head is on each beat of bar 3
MOD_ELL = [V_LOOP * (tm - T_BIZ) for tm in T_MODULES]
MOD_P = [loop_point(e)[0] for e in MOD_ELL]


def collapse(t):
    """(k_depth, k_width): 0 -> full loop, 1 -> collapsed. Bar 4, beats 3-4."""
    kd = ez.cubic_bezier(0.55, 0.0, 0.25, 1.0)(remap(t, 8.80, 9.50))
    kw = ez.cubic_bezier(0.50, 0.0, 0.10, 1.0)(remap(t, 9.28, 9.97))
    return kd, kw


STROKE_HALF = 0.36 * U     # final brand stroke half length (world)
STROKE_W = 0.043 * U       # final brand stroke thickness (world)


def squash(p, t):
    """Map a plan point of the running system into the collapsing system."""
    kd, kw = collapse(t)
    cx, cz = LOOP_C
    x = p[0]
    z = cz + (p[1] - cz) * (1 - kd)
    hx = (LOOP_X1 - LOOP_X0) / 2
    target_hx = STROKE_HALF
    sx = lerp(1.0, target_hx / hx, kw)
    x = cx + (x - cx) * sx
    return np.array([x, z])


def module_boxes(t):
    """The four stations. Each wakes on its beat, then works in time."""
    out = []
    kd, kw = collapse(t)
    sink = ez.cubic_bezier(0.55, 0, 0.35, 1)(remap(t, 8.70, 9.25))    # modules sink into the floor
    if sink >= 0.999:
        return out

    def add(lo, hi, st, name, yaw=0.0, anchor=None):
        lo = np.array(lo, float)
        hi = np.array(hi, float)
        if kd > 0 or kw > 0 or sink > 0:
            c = anchor if anchor is not None else np.array([(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2])
            nc = squash(c, t)
            dx, dz = nc[0] - c[0], nc[1] - c[1]
            lo = lo + [dx, 0, dz]
            hi = hi + [dx, 0, dz]
            hi[1] = lo[1] + (hi[1] - lo[1]) * (1 - sink)
            if hi[1] - lo[1] < 0.3:
                return
        out.append(Box(lo, hi, st, yaw=yaw, name=name))

    act = [ez.cubic_bezier(0.3, 0.0, 0.1, 1.0)(remap(t, tm - 0.05, tm + 0.45)) for tm in T_MODULES]

    # M1 intake: fins that comb the scattered input into one stream (straddles the lead-in)
    x, z = 2.0 * U, LOOP_Z0 - 0.62 * U
    anc = np.array([x, LOOP_Z0])
    add((x - 1.05 * U, 0, z - 0.55 * U), (x + 1.05 * U, 0.05 * U, z + 0.55 * U), IV_MOD_SOFT, 'M1base', anchor=anc)
    for i, dx in enumerate((-0.84, -0.5, 0.5, 0.84)):
        hgt = 0.62 * U * (0.35 + 0.65 * act[0])
        add((x + dx * U - 0.035 * U, 0.05 * U, z - 0.42 * U), (x + dx * U + 0.035 * U, 0.05 * U + hgt, z + 0.42 * U),
            IV_MOD, f'M1f{i}', anchor=anc)

    # M2 orders: a stack of plates, askew until the line arrives, then squared up
    p = MOD_P[1]
    n = outward(p)
    c = p + n * 1.15 * U
    rng = np.random.default_rng(11)
    for i in range(5):
        k = ez.cubic_bezier(0.4, 0, 0.1, 1)(remap(t, T_MODULES[1] + i * 0.065, T_MODULES[1] + 0.34 + i * 0.065))
        yaw = rng.uniform(-0.45, 0.45) * (1 - k)
        off = rng.uniform(-0.18, 0.18, 2) * U * (1 - k)
        y0 = 0.05 * U + i * 0.17 * U
        add((c[0] - 0.55 * U + off[0], y0, c[1] - 0.55 * U + off[1]),
            (c[0] + 0.55 * U + off[0], y0 + 0.07 * U, c[1] + 0.55 * U + off[1]), IV_MOD, f'M2s{i}', yaw=yaw, anchor=p)
    add((c[0] - 0.7 * U, 0, c[1] - 0.7 * U), (c[0] + 0.7 * U, 0.04 * U, c[1] + 0.7 * U), IV_MOD_SOFT, 'M2base', anchor=p)

    # M3 delivery: a gate over the line; its lintel is set in place when the line arrives
    p = MOD_P[2]
    x, z = p
    for sx in (-1, 1):
        add((x + sx * 0.62 * U - 0.08 * U, 0, z - 0.08 * U), (x + sx * 0.62 * U + 0.08 * U, 0.95 * U, z + 0.08 * U),
            IV_MOD, f'M3p{sx}', anchor=p)
    ky = ez.cubic_bezier(0.2, 0.0, 0.2, 1.0)(remap(t, T_MODULES[2] - 0.05, T_MODULES[2] + 0.36))
    kx = ez.cubic_bezier(0.5, 0.0, 0.1, 1.0)(remap(t, T_MODULES[2] - 0.02, T_MODULES[2] + 0.46))
    ly = lerp(0.0, 0.95 * U, ky)
    lz = lerp(-0.62 * U, 0.0, kx)
    add((x - 0.78 * U, ly, z - 0.1 * U + lz), (x + 0.78 * U, ly + 0.14 * U, z + 0.1 * U + lz), IV_MOD, 'M3l',
        anchor=p)
    # the gate's footprint, drawn as a thin threshold
    add((x - 0.78 * U, 0, z - 0.3 * U), (x + 0.78 * U, 0.03 * U, z + 0.3 * U), IV_MOD_SOFT, 'M3t', anchor=p)

    # M4 return: a tray where the finished units come to rest in order (3 x 3)
    p = MOD_P[3]
    n = outward(p)
    c = p + n * 1.25 * U
    add((c[0] - 0.62 * U, 0, c[1] - 0.62 * U), (c[0] + 0.62 * U, 0.06 * U, c[1] + 0.62 * U), IV_MOD_SOFT, 'M4base',
        anchor=p)
    for i in range(9):
        r_, c_ = divmod(i, 3)
        cx = c[0] + (c_ - 1) * 0.38 * U
        cz = c[1] + (r_ - 1) * 0.38 * U
        a = clamp((t - T_MODULES[3] - 0.1 - i * BEAT / 4) / 0.12)
        if a <= 0:
            # empty cell: a low rim
            add((cx - 0.15 * U, 0.06 * U, cz - 0.15 * U), (cx + 0.15 * U, 0.075 * U, cz + 0.15 * U),
                IV_MOD_SOFT, f'M4e{i}', anchor=p)
            continue
        hgt = 0.06 * U + 0.12 * U * ez.settle(a)
        add((cx - 0.15 * U, 0.06 * U, cz - 0.15 * U), (cx + 0.15 * U, hgt + 0.06 * U, cz + 0.15 * U),
            IV_UNIT, f'M4u{i}', anchor=p)
    return out


# the input: scattered units in front of the intake (fixed seed)
_rng = np.random.default_rng(20260928)
N_UNITS = 7
UNIT_SCATTER = []
for _i in range(N_UNITS):
    _side = -1 if _i % 2 else 1
    _x = 2.0 + _side * _rng.uniform(0.95, 2.5)
    UNIT_SCATTER.append((_x * U, _rng.uniform(13.6, 15.6) * U, _rng.uniform(-0.8, 0.8)))
UNIT_SCATTER.sort(key=lambda p: -p[1])


def unit_boxes(t):
    out = []
    kd, kw = collapse(t)
    shrink = ez.cubic_bezier(0.5, 0, 0.3, 1)(remap(t, 8.7, 9.3))
    if shrink >= 0.999:
        return out
    size = 0.21 * U
    # after the loop closes the train spreads out evenly: steady state
    spread = ez.gentle(remap(t, T_LOOP, T_LOOP + 1.25))
    gap0 = 1.15 * U
    gap = lerp(gap0, LOOP_LEN / N_UNITS, spread)
    lag = 1.6 * U                                                   # behind the head
    head_ell = V_LOOP * (t - T_BIZ)
    for i, (sx, sz, syaw) in enumerate(UNIT_SCATTER):
        if t < T_LOOP:
            ell = head_ell - lag - i * gap
        else:   # loop closed: the flow eases into a calm, steady circulation
            tau, T = t - T_LOOP, 1.1
            x = min(tau / T, 1.0)
            run = T * (x - 0.4 * (x ** 3 - x ** 4 / 2)) + (0.6 * (tau - T) if tau > T else 0.0)
            ell = V_LOOP * (T_LOOP - T_BIZ) - lag + V_LOOP * run - i * gap
        t_join = T_BIZ + (lag + i * gap0) / V_LOOP                  # slot passes the junction
        g = ez.cubic_bezier(0.45, 0.0, 0.2, 1.0)(remap(t, t_join - 0.42, t_join + 0.06))
        if ell < 0:
            q, d = LINE.at(S_LOOP0 + ell)
        else:
            q, d = loop_point(ell)
        qx, qz = q
        yaw_line = math.atan2(d[0], d[1])
        x = lerp(sx, qx, g)
        z = lerp(sz, qz, g)
        yaw = lerp(syaw, yaw_line, g)
        # delivered units become flat tiles between the gate and the intake
        on_loop = ell >= 0 and g > 0.99
        e = (ell % LOOP_LEN) if on_loop else -1
        flat = 0.0
        if on_loop:
            a0, a1 = MOD_ELL[2], LOOP_LEN
            flat = clamp((e - a0) / (0.35 * U)) * clamp((a1 - e) / (0.35 * U))
        hgt = lerp(size, 0.07 * U, flat) * (1 - shrink)
        wid = lerp(size, 0.30 * U, flat) * (1 - shrink)
        if hgt < 0.3:
            continue
        pc = squash((x, z), t)
        out.append(Box((pc[0] - wid / 2, 0.0, pc[1] - wid / 2), (pc[0] + wid / 2, hgt, pc[1] + wid / 2),
                       IV_UNIT, yaw=yaw, name=f'U{i}'))
    return out


def draw_guides(canvas, cam, t):
    """The existing channel between stations: two fine rules, broken half-way
    between stations. The line closes the breaks as it passes."""
    fade = 1.0 - ez.smoothstep(remap(t, 8.6, 9.2))
    if fade <= 0:
        return
    pnt = paint(G, 0.20 * fade, stroke=1.0)
    q4 = LOOP_LEN / 4
    step = 0.12 * U
    for off in (-0.2 * U, 0.2 * U):
        run = []
        ell = 0.0
        while ell <= LOOP_LEN + 1e-6:
            q = (ell % q4) / q4
            broken = 0.40 < q < 0.60
            if not broken:
                p0, d0 = loop_point(ell)
                n = np.array([-d0[1], d0[0]])
                run.append(squash(p0 + n * off, t))
            if broken or ell + step > LOOP_LEN:
                for a, b_ in zip(run[:-1], run[1:]):
                    draw_line3d(canvas, cam, (a[0], 0.1, a[1]), (b_[0], 0.1, b_[1]), pnt)
                run = []
            ell += step


def draw_collapsed_line(canvas, cam, t, w):
    """From the moment the loop starts to fold, draw it as a parametric rounded rect."""
    kd, kw = collapse(t)
    cx, cz = LOOP_C
    hx = lerp((LOOP_X1 - LOOP_X0) / 2, STROKE_HALF, kw)
    hz = (LOOP_Z1 - LOOP_Z0) / 2 * (1 - kd)
    if hz > w * 0.5:
        r = min(R_LOOP, hz, hx)
        pts = rounded_rect(cx, cz, hx, hz, r)
        outer = offset_poly(pts, w / 2)
        inner = offset_poly(pts, -w / 2)
        path = skia.Path()
        path.setFillType(skia.PathFillType.kEvenOdd)
        for poly in (outer, inner):
            P = np.array([[p[0], 0.2, p[1]] for p in poly])
            Pc = clip_near(cam.to_cam(P), cam.near)
            if len(Pc) >= 3:
                path.addPath(poly_path(cam.proj(Pc)))
        canvas.drawPath(path, paint(R))
    else:
        # a single bar with rounded ends — becomes the brand stroke
        hz2 = max(hz, 0.0)
        thick = w + 2 * hz2
        half = max(hx - hz2, 0.5)
        path = FloorPath([(cx - half, cz), (cx + half, cz)])
        poly = ribbon_polygon(path, 0, path.length, thick)
        draw_poly3d(canvas, cam, poly, paint(R))


def rounded_rect(cx, cz, hx, hz, r, n=10):
    pts = []
    for (qx, qz, a0) in ((cx + hx - r, cz + hz - r, 0), (cx - hx + r, cz + hz - r, 90),
                         (cx - hx + r, cz - hz + r, 180), (cx + hx - r, cz - hz + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((qx + r * math.cos(a), qz + r * math.sin(a)))
    return pts


def offset_poly(pts, d):
    """Offset a convex CCW polygon outward by d (negative = inward)."""
    P = np.array(pts)
    out = []
    n = len(P)
    for i in range(n):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        e1 = b - a
        e2 = c - b
        n1 = np.array([e1[1], -e1[0]])
        n2 = np.array([e2[1], -e2[0]])
        n1 /= max(np.linalg.norm(n1), 1e-9)
        n2 /= max(np.linalg.norm(n2), 1e-9)
        nn = n1 + n2
        nn /= max(np.linalg.norm(nn), 1e-9)
        out.append(b + nn * d)
    return out


# ======================================================================= camera
# (t, [x, y, z, yaw, pitch, f]) — first two keys authored with compose.solve()
def _k(t, x, y, z, yaw, pitch, f):
    return (t, [x * U, y * U, z * U, math.radians(yaw), math.radians(pitch), f])


CAM_KEYS = [
    _k(0.00, 0.133, 7.591, -7.695, 8.98, -28.41, 1458.7),
    _k(2.50, 0.275, 4.800, -3.193, 9.88, -23.82, 1250.0),
    _k(3.125, 0.62, 4.10, -2.10, 7.0, -21.0, 1250.0),
    _k(3.80, 1.30, 3.50, -0.30, 3.0, -16.0, 1250.0),
    _k(4.10, 1.90, 1.95, 3.70, 0.5, -8.5, 1260.0),
    _k(4.36, 2.00, 1.20, 7.35, 0.0, -4.0, 1270.0),
    _k(4.60, 2.00, 1.10, 8.98, 0.0, -4.0, 1270.0),
    _k(4.78, 2.00, 1.45, 9.80, 0.0, -8.0, 1265.0),
    _k(5.00, 2.000, 3.40, 10.85, 0.00, -18.5, 1250.0),
    _k(6.25, 2.000, 6.276, 11.209, 0.00, -32.92, 1250.0),
    _k(7.50, 2.000, 8.092, 11.354, 0.00, -40.82, 1250.0),
    _k(8.75, 2.000, 11.459, 12.456, 0.00, -54.14, 1250.0),
    _k(10.0, 2.00, 9.60, 19.0 + (576.0 - H / 2) * 9.60 / 1400.0, 0.0, -90.0, 1400.0),
    _k(15.0, 2.00, 9.60, 19.0 + (576.0 - H / 2) * 9.60 / 1400.0, 0.0, -90.0, 1400.0),
]
_cam = ez.Track(CAM_KEYS)


def camera(t):
    v = _cam(t)
    return Camera(v[:3], v[3], v[4], v[5])


# ======================================================================= overlays
def draw_core_text(canvas, t):
    """把 AI，变成生意。 — the value line. Rises out of a mask; exits cleanly."""
    if t < T_BIZ - 0.01 or t > 9.7:
        return
    ln = txt('core')
    cx, cy = W / 2, 238
    ox, oy = ln.origin_for_center(cx, cy)
    top = oy + ln.ink_top - 6
    bot = oy + ln.ink_bottom + 8
    exit_k = ez.cubic_bezier(0.5, 0, 0.75, 0.2)(remap(t, 9.18, 9.55))
    canvas.save()
    canvas.clipRect(skia.Rect.MakeLTRB(0, top - 40, W, bot), doAntiAlias=True)

    def per_glyph(i, ch):
        t0 = T_BIZ + 0.02 + i * 0.038
        k = ez.cubic_bezier(0.2, 0.0, 0.0, 1.0)(remap(t, t0, t0 + 0.5))
        dy = (1 - k) * (bot - top + 6) - exit_k * 26
        return (0.0, dy, 1.0 - exit_k)
    ln.draw(canvas, ox, oy, paint(G), per_glyph)
    canvas.restore()


BRAND_CY, STROKE_Y, SLOGAN_CY = 466.0, 576.0, 652.0


def draw_brand(canvas, t):
    if t < T_BRAND - 0.001:
        return
    b = txt('brand')
    s = txt('slogan')
    # brand: rises from the stroke; slogan: descends from it (the stroke releases both)
    k1 = ez.cubic_bezier(0.16, 0.0, 0.0, 1.0)(remap(t, T_BRAND, T_BRAND + 0.52))
    k2 = ez.cubic_bezier(0.16, 0.0, 0.0, 1.0)(remap(t, T_BRAND + 0.07, T_BRAND + 0.55))
    ox, oy = b.origin_for_center(W / 2, BRAND_CY)
    canvas.save()
    canvas.clipRect(skia.Rect.MakeLTRB(0, 0, W, STROKE_Y - 14), doAntiAlias=True)
    b.draw(canvas, ox, oy + (1 - k1) * 165, paint(G))
    canvas.restore()
    ox, oy = s.origin_for_center(W / 2, SLOGAN_CY)
    canvas.save()
    canvas.clipRect(skia.Rect.MakeLTRB(0, STROKE_Y + 12, W, H), doAntiAlias=True)
    s.draw(canvas, ox, oy - (1 - k2) * 118, paint(mix(G, I, 0.14)))
    canvas.restore()


# ======================================================================= render
def draw_pool(canvas, cam, c, r, col, alpha, power=2.2):
    half = r * 2.0

    def shader(size):
        # many stops + smoothstep shoulder: no Mach bands on large quiet areas
        stops = list(np.linspace(0.0, 1.0, 48))
        cols = [sk(col, alpha * (1 - s * s) ** power).toColor() for s in stops]   # flat centre, soft edge
        return skia.GradientShader.MakeRadial(skia.Point(size / 2, size / 2), size / 2, cols, stops)
    draw_floor_shader(canvas, cam, c[0], c[2], half, shader)


def draw_grid(canvas, cam, x0, x1, z0, z1, col, alpha, focus, radius, pieces=24):
    def k_at(x, z):
        return alpha * math.exp(-((x - focus[0]) ** 2 + (z - focus[1]) ** 2) / radius ** 2)
    for gx in range(int(math.ceil(x0)), int(math.floor(x1)) + 1):
        X = gx * U
        zs = np.linspace(z0 * U, z1 * U, pieces + 1)
        for a, b in zip(zs[:-1], zs[1:]):
            k = k_at(X, (a + b) / 2)
            if k > 0.004:
                draw_line3d(canvas, cam, (X, 0.05, a), (X, 0.05, b), paint(col, k, stroke=1.0))
    for gz in range(int(math.ceil(z0)), int(math.floor(z1)) + 1):
        Z = gz * U
        xs = np.linspace(x0 * U, x1 * U, pieces + 1)
        for a, b in zip(xs[:-1], xs[1:]):
            k = k_at((a + b) / 2, Z)
            if k > 0.004:
                draw_line3d(canvas, cam, (a, 0.05, Z), (b, 0.05, Z), paint(col, k, stroke=1.0))


def draw_dark_floor(canvas, cam):
    near_c, far_c = mix(G, I, 0.04), G
    d = cam.to_cam(np.array([cam.pos + np.array([cam.fwd[0], 0, cam.fwd[2]]) * 1e6]))
    y_h = float(cam.proj(d)[0, 1]) if d[0, 2] > 0 else -H
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, H), skia.Point(0, max(y_h, -2 * H))], [sk(near_c).toColor(), sk(far_c).toColor()]))
    draw_poly3d(canvas, cam, floor_poly([(-60 * U, -30 * U), (60 * U, -30 * U),
                                         (60 * U, Z_WALL1), (-60 * U, Z_WALL1)]), p)


IV_EDGE = mix(I, G, 0.045)     # the ivory falls off gently away from the light


def render_ivory(canvas, cam, t):
    """Everything beyond the end wall."""
    draw_poly3d(canvas, cam, floor_poly([(-80 * U, Z_WALL1), (80 * U, Z_WALL1),
                                         (80 * U, 140 * U), (-80 * U, 140 * U)]), paint(IV_EDGE))
    draw_pool(canvas, cam, (LOOP_C[0], 0, LOOP_C[1] - 0.6 * U), 7.5 * U, I, 1.0, power=1.1)
    gfade = 1.0 - ez.smoothstep(remap(t, 8.5, 9.4))
    if gfade > 0:
        draw_grid(canvas, cam, -8, 12, 9.6, 25, G, 0.07 * gfade, (LOOP_C[0], LOOP_C[1] - 0.5 * U), 6.5 * U,
                  pieces=30)
    boxes = module_boxes(t) + unit_boxes(t)
    for b in boxes:
        draw_shadow(canvas, cam, b, G, 0.16, 0.16 * U, length=0.9)
    draw_guides(canvas, cam, t)
    w = line_width(t)
    kd, kw = collapse(t)
    if kd > 0:
        draw_collapsed_line(canvas, cam, t, lerp(w, STROKE_W, kw))
    else:
        s0 = max(tail_s(t), S_WALL)
        draw_ribbon(canvas, cam, s0, head_s(t), w)
    for b in sort_boxes(boxes, cam):
        draw_box(canvas, cam, b)


def render(canvas, t):
    cam = camera(t)
    in_dark = cam.pos[2] < Z_WALL1 + 1.0
    if in_dark:
        canvas.clear(sk(IV_EDGE))
        render_ivory(canvas, cam, t)          # only visible through the slit
        engine3d.POOL.update(c=np.array([1.2 * U, 0.0, 5.6 * U]), r=4.2 * U, col=mix(G, I, 0.32))
        draw_dark_floor(canvas, cam)
        draw_pool(canvas, cam, (1.2 * U, 0, 5.2 * U), 4.6 * U, I, 0.075)
        draw_grid(canvas, cam, -12, 14, -6, 8.9, I, 0.085, (1.2 * U, 4.8 * U), 5.5 * U)
        boxes = dark_boxes(t)
        for b in boxes:
            if not b.style.wire:
                draw_shadow(canvas, cam, b, G * 0.4, 0.55, 10.0, length=0.55)
        draw_decals_dark(canvas, cam, t)
        w = line_width(t)
        if t < T_TURN or head_s(t) < 1.0:
            draw_dot(canvas, cam, min(t, T_TURN - 1e-6), w)
        else:
            draw_ribbon(canvas, cam, 0.0, min(head_s(t), S_WALL), w, halo=0.22)
        draw_end_wall(canvas, cam)
        for b in sort_boxes(boxes, cam):
            draw_box(canvas, cam, b)
        engine3d.POOL.update(c=None)
    else:
        canvas.clear(sk(IV_EDGE))
        render_ivory(canvas, cam, t)
    draw_core_text(canvas, t)
    draw_brand(canvas, t)
    return cam
