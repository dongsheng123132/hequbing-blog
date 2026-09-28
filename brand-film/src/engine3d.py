"""A small, deterministic 3D vector renderer on top of Skia.

World: X right, Y up, Z forward (away from the opening camera). Floor is Y=0.
Everything that sits on the floor is an axis-aligned box (optionally yawed),
so painter's ordering can be solved exactly with separating axes.
"""
import math

import numpy as np
import skia

from timeline import W, H

# --------------------------------------------------------------------------
# Palette: three colours only. Every other tone is a mix of these three.
GRAPHITE = np.array([0x11, 0x12, 0x14]) / 255.0
IVORY = np.array([0xF1, 0xEC, 0xE3]) / 255.0
VERMILION = np.array([0xB9, 0x2D, 0x27]) / 255.0


def mix(a, b, t):
    return a + (b - a) * t


def sk(c, a=1.0):
    c = np.clip(c, 0, 1)
    return skia.Color4f(float(c[0]), float(c[1]), float(c[2]), float(max(0.0, min(1.0, a))))


def paint(c, a=1.0, aa=True, stroke=None, blur=None, cap=None, join=None):
    p = skia.Paint(AntiAlias=aa, Color4f=sk(c, a))
    if stroke is not None:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(stroke)
        p.setStrokeCap(cap or skia.Paint.kButt_Cap)
        p.setStrokeJoin(join or skia.Paint.kMiter_Join)
    if blur:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    return p


# --------------------------------------------------------------------------
class Camera:
    def __init__(self, pos, yaw, pitch, f, roll=0.0):
        self.pos = np.asarray(pos, dtype=float)
        self.yaw, self.pitch, self.f = yaw, pitch, f
        cy, sy = math.cos(yaw), math.sin(yaw)
        cp, sp = math.cos(pitch), math.sin(pitch)
        fwd = np.array([cp * sy, sp, cp * cy])
        right = np.array([cy, 0.0, -sy])
        up = np.cross(fwd, right)
        if roll:
            cr, sr = math.cos(roll), math.sin(roll)
            right, up = right * cr + up * sr, up * cr - right * sr
        self.fwd, self.right, self.up = fwd, right, up
        self.R = np.stack([right, up, fwd])  # rows
        self.cx, self.cy = W / 2.0, H / 2.0
        self.near = 2.0

    @staticmethod
    def look(pos, target, f, roll=0.0):
        d = np.asarray(target, float) - np.asarray(pos, float)
        yaw = math.atan2(d[0], d[2])
        pitch = math.atan2(d[1], math.hypot(d[0], d[2]))
        return Camera(pos, yaw, pitch, f, roll)

    def to_cam(self, P):
        return (np.asarray(P, float) - self.pos) @ self.R.T

    def proj(self, Pc):
        Pc = np.atleast_2d(Pc)
        z = Pc[:, 2]
        x = self.cx + self.f * Pc[:, 0] / z
        y = self.cy - self.f * Pc[:, 1] / z
        return np.stack([x, y], axis=1)

    def scale_at(self, depth):
        return self.f / max(depth, self.near)


def clip_near(Pc, near):
    """Sutherland-Hodgman against z >= near (camera space polygon)."""
    out = []
    n = len(Pc)
    for i in range(n):
        a, b = Pc[i], Pc[(i + 1) % n]
        ina, inb = a[2] >= near, b[2] >= near
        if ina:
            out.append(a)
        if ina != inb:
            t = (near - a[2]) / (b[2] - a[2])
            out.append(a + (b - a) * t)
    return np.array(out) if out else np.zeros((0, 3))


def clip_segment(a, b, near):
    ina, inb = a[2] >= near, b[2] >= near
    if ina and inb:
        return a, b
    if not ina and not inb:
        return None
    t = (near - a[2]) / (b[2] - a[2])
    m = a + (b - a) * t
    return (a, m) if ina else (m, b)


def poly_path(pts2d):
    p = skia.Path()
    if len(pts2d) < 3:
        return p
    p.moveTo(float(pts2d[0][0]), float(pts2d[0][1]))
    for q in pts2d[1:]:
        p.lineTo(float(q[0]), float(q[1]))
    p.close()
    return p


def draw_poly3d(canvas, cam, P, pnt):
    Pc = clip_near(cam.to_cam(P), cam.near)
    if len(Pc) < 3:
        return None
    path = poly_path(cam.proj(Pc))
    canvas.drawPath(path, pnt)
    return path


def draw_line3d(canvas, cam, a, b, pnt):
    ac, bc = cam.to_cam(np.array([a, b]))
    seg = clip_segment(ac, bc, cam.near)
    if seg is None:
        return
    p = cam.proj(np.array(seg))
    canvas.drawLine(float(p[0, 0]), float(p[0, 1]), float(p[1, 0]), float(p[1, 1]), pnt)


# --------------------------------------------------------------------------
# Boxes
FACES = {
    # name: (normal, corner indices on the unit cube, CCW seen from outside)
    'top': ((0, 1, 0), (2, 3, 7, 6)),
    'bottom': ((0, -1, 0), (0, 4, 5, 1)),
    'front': ((0, 0, -1), (0, 1, 3, 2)),   # faces -Z (towards the opening camera)
    'back': ((0, 0, 1), (4, 6, 7, 5)),
    'left': ((-1, 0, 0), (0, 2, 6, 4)),
    'right': ((1, 0, 0), (1, 5, 7, 3)),
}
# corner i: bit0 -> x, bit1 -> y, bit2 -> z
CORNER_BITS = np.array([[(i >> 0) & 1, (i >> 1) & 1, (i >> 2) & 1] for i in range(8)], float)


class Box:
    def __init__(self, lo, hi, style, yaw=0.0, name=None, decals=None, alpha=1.0):
        self.lo = np.asarray(lo, float)
        self.hi = np.asarray(hi, float)
        self.style = style
        self.yaw = yaw
        self.name = name
        self.decals = decals or {}
        self.alpha = alpha

    def corners(self):
        c = self.lo + CORNER_BITS * (self.hi - self.lo)
        if self.yaw:
            ctr = (self.lo + self.hi) / 2
            cy, sy = math.cos(self.yaw), math.sin(self.yaw)
            d = c - ctr
            x = d[:, 0] * cy + d[:, 2] * sy
            z = -d[:, 0] * sy + d[:, 2] * cy
            c = np.stack([x + ctr[0], c[:, 1], z + ctr[2]], axis=1)
        return c

    def aabb(self):
        if not self.yaw:
            return self.lo, self.hi
        c = self.corners()
        return c.min(0), c.max(0)

    def normal(self, face):
        n = np.array(FACES[face][0], float)
        if self.yaw:
            cy, sy = math.cos(self.yaw), math.sin(self.yaw)
            n = np.array([n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy])
        return n


class Style:
    """Surface description. Colours are mixes of the palette."""

    def __init__(self, lit, unlit, edge=None, edge_alpha=0.0, edge_w=1.0, edges='top',
                 wire=False, shadow=0.0, fog=None, top=None, ao=0.0, ao_col=None, pool=0.0):
        self.lit, self.unlit = lit, unlit
        self.ao, self.ao_col, self.pool = ao, ao_col, pool
        self.top = top
        self.edge, self.edge_alpha, self.edge_w, self.edges = edge, edge_alpha, edge_w, edges
        self.wire = wire
        self.shadow = shadow
        self.fog = fog


LIGHT = np.array([-0.42, 0.84, -0.34])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# A soft pool of light on the scene (centre xyz, radius, colour). Set per frame.
POOL = {'c': None, 'r': 1.0, 'col': None}


def pool_k(p):
    if POOL['c'] is None:
        return 0.0
    d = np.array(p, float) - POOL['c']
    return math.exp(-(d[0] ** 2 + d[2] ** 2 + 0.25 * d[1] ** 2) / (POOL['r'] ** 2))


def face_color(style, n):
    if style.top is not None and n[1] > 0.9:
        return style.top
    k = 0.5 + 0.5 * float(np.dot(n, LIGHT))
    return mix(style.unlit, style.lit, k)


def sort_boxes(boxes, cam):
    """Exact painter's order for disjoint axis-aligned boxes (far -> near)."""
    n = len(boxes)
    if n < 2:
        return list(boxes)
    lo = np.array([b.aabb()[0] for b in boxes])
    hi = np.array([b.aabb()[1] for b in boxes])
    c = cam.pos
    ctr = (lo + hi) / 2
    dist = np.linalg.norm(ctr - c, axis=1)
    before = [set() for _ in range(n)]  # before[j] = set of i that must be drawn before j
    eps = 1e-6
    for i in range(n):
        for j in range(i + 1, n):
            decided = False
            for k in (0, 2, 1):
                if hi[i][k] <= lo[j][k] + eps:      # i on the low side of j
                    if c[k] >= lo[j][k]:
                        before[j].add(i); decided = True; break
                    if c[k] <= hi[i][k]:
                        before[i].add(j); decided = True; break
                elif hi[j][k] <= lo[i][k] + eps:    # j on the low side of i
                    if c[k] >= lo[i][k]:
                        before[i].add(j); decided = True; break
                    if c[k] <= hi[j][k]:
                        before[j].add(i); decided = True; break
            if not decided:
                if dist[i] > dist[j]:
                    before[j].add(i)
                else:
                    before[i].add(j)
    # Kahn with far-first tie break
    indeg = [len(before[j]) for j in range(n)]
    after = [[] for _ in range(n)]
    for j in range(n):
        for i in before[j]:
            after[i].append(j)
    ready = [j for j in range(n) if indeg[j] == 0]
    order = []
    done = [False] * n
    while len(order) < n:
        if not ready:  # cycle: break with the farthest remaining
            rest = [j for j in range(n) if not done[j]]
            ready = [max(rest, key=lambda j: dist[j])]
            indeg[ready[0]] = 0
        ready.sort(key=lambda j: -dist[j])
        j = ready.pop(0)
        if done[j]:
            continue
        done[j] = True
        order.append(boxes[j])
        for k in after[j]:
            indeg[k] -= 1
            if indeg[k] == 0 and not done[k]:
                ready.append(k)
    return order


def fog_mix(col, depth, fog):
    if fog is None:
        return col
    fcol, d0, d1, amax = fog
    k = min(max((depth - d0) / (d1 - d0), 0.0), 1.0) * amax
    return mix(col, fcol, k)


def draw_box(canvas, cam, box):
    st = box.style
    C = box.corners()
    Cc = cam.to_cam(C)
    if (Cc[:, 2] < cam.near).all():
        return
    depth = float(np.linalg.norm((box.lo + box.hi) / 2 - cam.pos))
    visible = []
    for name, (nrm, idx) in FACES.items():
        n = box.normal(name)
        pc = C[list(idx)].mean(0)
        if np.dot(n, cam.pos - pc) <= 0:
            continue
        visible.append((name, n, idx))
    a = box.alpha
    if a <= 0.001:
        return
    for name, n, idx in visible:
        P = C[list(idx)]
        if not st.wire:
            fc = P.mean(0)
            fdepth = float(np.linalg.norm(fc - cam.pos))
            col = face_color(st, n)
            if st.pool and POOL['c'] is not None:
                col = mix(col, POOL['col'], st.pool * pool_k(fc))
            col = fog_mix(col, fdepth, st.fog)
            pnt = paint(col, a)
            if st.ao and abs(n[1]) < 0.5:
                # darker towards the floor: cheap ambient occlusion
                bot = P[P[:, 1] <= P[:, 1].min() + 1e-6].mean(0)
                top = P[P[:, 1] >= P[:, 1].max() - 1e-6].mean(0)
                h = top[1] - bot[1]
                mid = bot + (top - bot) * min(1.0, 45.0 / max(h, 1e-6))
                pc = cam.to_cam(np.array([bot, mid]))
                if (pc[:, 2] > cam.near).all():
                    sp = cam.proj(pc)
                    aoc = mix(col, st.ao_col if st.ao_col is not None else col * 0.0, st.ao)
                    sh = skia.GradientShader.MakeLinear(
                        [skia.Point(*sp[0]), skia.Point(*sp[1])],
                        [sk(aoc, a).toColor(), sk(col, a).toColor()])
                    if sh is not None:
                        pnt.setShader(sh)
            path = draw_poly3d(canvas, cam, P, pnt)
            if name in box.decals and path is not None:
                box.decals[name](canvas, cam, P, path)
    if st.edge is not None and st.edge_alpha > 0:
        ea = st.edge_alpha * a
        col = fog_mix(st.edge, depth, st.fog)
        pe = paint(col, ea, stroke=st.edge_w)
        edges = set()
        for name, n, idx in visible:
            if st.edges == 'top' and name != 'top':
                continue
            ii = list(idx)
            for k in range(4):
                e = tuple(sorted((ii[k], ii[(k + 1) % 4])))
                edges.add(e)
        if st.edges == 'rim':
            # vertical edges shared by two visible side faces + silhouette verticals
            for name, n, idx in visible:
                if name == 'top':
                    continue
                ii = list(idx)
                for k in range(4):
                    e = tuple(sorted((ii[k], ii[(k + 1) % 4])))
                    # vertical edge: corners differ only in y bit
                    if (e[0] ^ e[1]) == 2:
                        edges.add(e)
        for e in edges:
            draw_line3d(canvas, cam, C[e[0]], C[e[1]], pe)


# --------------------------------------------------------------------------
# Floor-plane helpers
def floor_poly(pts_xz, y=0.0):
    return np.array([[p[0], y, p[1]] for p in pts_xz], float)


def draw_floor_quad(canvas, cam, x0, z0, x1, z1, pnt, y=0.0):
    return draw_poly3d(canvas, cam, floor_poly([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y), pnt)


def shadow_polygon(box, light=LIGHT, length=1.0):
    """Floor shadow of a box: hull of footprint and top face pushed along light."""
    C = box.corners()
    top = C[C[:, 1] > (box.lo[1] + box.hi[1]) / 2]
    base = C[C[:, 1] <= (box.lo[1] + box.hi[1]) / 2].copy()
    base[:, 1] = 0
    d = -light / light[1]  # direction to travel down to the floor
    proj = top + d[None, :] * (top[:, 1:2]) * length
    proj[:, 1] = 0
    pts = np.concatenate([base, proj])[:, [0, 2]]
    return convex_hull(pts)


def convex_hull(pts):
    pts = sorted(map(tuple, pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def draw_shadow(canvas, cam, box, col, alpha, blur_world, length=1.0):
    hull = shadow_polygon(box, length=length)
    if len(hull) < 3:
        return
    ctr = np.array([[(box.lo[0] + box.hi[0]) / 2, 0, (box.lo[2] + box.hi[2]) / 2]])
    depth = float(cam.to_cam(ctr)[0, 2])
    if depth < cam.near:
        return
    sigma = max(0.3, blur_world * cam.f / depth)
    draw_poly3d(canvas, cam, floor_poly(hull), paint(col, alpha, blur=sigma))


# --------------------------------------------------------------------------
# Ribbon on the floor (the vermilion line)
class FloorPath:
    """Polyline on the floor (x, z) with filleted corners, arc-length sampled."""

    def __init__(self, pts, radius=0.0, step=4.0):
        pts = [np.array(p, float) for p in pts]
        radii = list(radius) if isinstance(radius, (list, tuple)) else [radius] * len(pts)
        dense = [pts[0]]
        for i in range(1, len(pts) - 1):
            radius = radii[i - 1] if isinstance(radii, list) and len(radii) == len(pts) - 2 else radii[i]
            a, b, c = pts[i - 1], pts[i], pts[i + 1]
            d1 = (b - a) / np.linalg.norm(b - a)
            d2 = (c - b) / np.linalg.norm(c - b)
            cosang = float(np.clip(np.dot(d1, d2), -1, 1))
            if radius <= 0 or cosang > 0.9999:
                dense.append(b)
                continue
            ang = math.acos(cosang)
            tlen = radius * math.tan(ang / 2)
            tlen = min(tlen, np.linalg.norm(b - a) / 2, np.linalg.norm(c - b) / 2)
            r = tlen / math.tan(ang / 2)
            p1 = b - d1 * tlen
            p2 = b + d2 * tlen
            # circle centre
            nrm = np.array([-d1[1], d1[0]])
            if np.dot(nrm, d2) < 0:
                nrm = -nrm
            ctr = p1 + nrm * r
            a1 = math.atan2(p1[1] - ctr[1], p1[0] - ctr[0])
            a2 = math.atan2(p2[1] - ctr[1], p2[0] - ctr[0])
            da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
            nseg = max(4, int(abs(da) * r / step))
            for k in range(nseg + 1):
                aa = a1 + da * k / nseg
                dense.append(ctr + r * np.array([math.cos(aa), math.sin(aa)]))
        dense.append(pts[-1])
        # resample uniformly
        P = np.array(dense)
        seglen = np.linalg.norm(np.diff(P, axis=0), axis=1)
        keep = np.concatenate([[True], seglen > 1e-6])
        P = P[keep]
        seglen = np.linalg.norm(np.diff(P, axis=0), axis=1)
        self.P = P
        self.s = np.concatenate([[0.0], np.cumsum(seglen)])
        self.length = float(self.s[-1])

    def at(self, s):
        s = min(max(s, 0.0), self.length)
        i = int(np.searchsorted(self.s, s, side='right') - 1)
        i = min(max(i, 0), len(self.P) - 2)
        t = (s - self.s[i]) / max(self.s[i + 1] - self.s[i], 1e-9)
        p = self.P[i] + (self.P[i + 1] - self.P[i]) * t
        d = self.P[i + 1] - self.P[i]
        d = d / max(np.linalg.norm(d), 1e-9)
        return p, d

    def nearest(self, p):
        p = np.asarray(p, float)
        d = np.linalg.norm(self.P - p[None, :], axis=1)
        i = int(np.argmin(d))
        return float(self.s[i])

    def between(self, s0, s1, step=6.0):
        s0, s1 = max(0.0, s0), min(self.length, s1)
        if s1 <= s0:
            return np.zeros((0, 2)), np.zeros((0, 2))
        inner = self.s[(self.s > s0) & (self.s < s1)]
        extra = np.arange(s0, s1, step)
        ss = np.unique(np.concatenate([[s0], inner, extra, [s1]]))
        pts, dirs = [], []
        for s in ss:
            p, d = self.at(s)
            pts.append(p)
            dirs.append(d)
        return np.array(pts), np.array(dirs)


def ribbon_polygon(path, s0, s1, width, head_round=True, tail_round=True, y=0.2):
    hw = width / 2.0
    if s1 - s0 < 1e-3:
        p, d = path.at(s0)
        ang = np.linspace(0, 2 * math.pi, 40, endpoint=False)
        return np.array([[p[0] + hw * math.cos(a), y, p[1] + hw * math.sin(a)] for a in ang])
    pts, dirs = path.between(s0, s1)
    # smooth normals across polyline vertices
    nrm = np.stack([-dirs[:, 1], dirs[:, 0]], axis=1)
    left = pts + nrm * hw
    right = pts - nrm * hw
    out = []
    # tail cap
    for p in left:
        out.append(p)
    if head_round:
        p, d = pts[-1], dirs[-1]
        n = np.array([-d[1], d[0]])
        base = math.atan2(n[1], n[0])
        for k in range(1, 12):
            a = base - math.pi * k / 12
            out.append(p + hw * np.array([math.cos(a), math.sin(a)]))
    for p in right[::-1]:
        out.append(p)
    if tail_round:
        p, d = pts[0], dirs[0]
        n = np.array([d[1], -d[0]])
        base = math.atan2(n[1], n[0])
        for k in range(1, 12):
            a = base - math.pi * k / 12
            out.append(p + hw * np.array([math.cos(a), math.sin(a)]))
    return np.array([[q[0], y, q[1]] for q in out])


# --------------------------------------------------------------------------
def homography_matrix(src4, dst4):
    m = skia.Matrix()
    ok = m.setPolyToPoly([skia.Point(float(x), float(y)) for x, y in src4],
                         [skia.Point(float(x), float(y)) for x, y in dst4])
    return m if ok else None


def draw_floor_shader(canvas, cam, cx, cz, half, shader_fn, y=0.02):
    """Fill the floor square [cx-half, cx+half] x [cz-half, cz+half] with a shader
    defined in local square coordinates (0..2*half), mapped with true perspective.
    The square is subdivided so near-plane clipping stays exact."""
    n = 4
    size = 2 * half
    for i in range(n):
        for j in range(n):
            u0, u1 = i * size / n, (i + 1) * size / n
            v0, v1 = j * size / n, (j + 1) * size / n
            P = np.array([[cx - half + u0, y, cz - half + v0], [cx - half + u1, y, cz - half + v0],
                          [cx - half + u1, y, cz - half + v1], [cx - half + u0, y, cz - half + v1]])
            Pc = cam.to_cam(P)
            if (Pc[:, 2] < cam.near).any():
                continue
            dst = cam.proj(Pc)
            m = homography_matrix([(u0, v0), (u1, v0), (u1, v1), (u0, v1)], dst)
            if m is None:
                continue
            canvas.save()
            canvas.clipPath(poly_path(dst), doAntiAlias=False)
            canvas.concat(m)
            p = skia.Paint(AntiAlias=False)
            p.setShader(shader_fn(size))
            canvas.drawRect(skia.Rect.MakeLTRB(u0 - 1, v0 - 1, u1 + 1, v1 + 1), p)
            canvas.restore()
