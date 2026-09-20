// Walking routes over the campus paths the map already draws.
//
// The graph is built from the same OSM highway ways the map renders as roads and footpaths,
// joined on shared OSM node ids, so a route always follows a path you can see on the board.
// Swap in better campus path data later by replacing buildGraph() — nothing else changes.

// Cost multiplier per highway type: lower is preferred. Footpaths win over roads.
const WALKABLE = {
  footway: 1, path: 1, pedestrian: 1, steps: 1.15, cycleway: 1.05, corridor: 1,
  service: 1.15, living_street: 1.2, residential: 1.3, unclassified: 1.3, track: 1.4,
  tertiary: 1.4, tertiary_link: 1.4, secondary: 1.7, secondary_link: 1.7, primary: 2, primary_link: 2,
};
const PACE = { normal: 78, limited: 55 };       // meters per minute
const STAIR_PENALTY = 6;                        // cost multiplier when a step-free route is requested but stairs are unavoidable

export function buildGraph(elements, toXY) {
  const index = new Map();                       // OSM node id -> graph index
  const xs = [], ys = [], adj = [];
  const nodeAt = (id, x, y) => {
    let i = index.get(id);
    if (i === undefined) { i = xs.length; index.set(id, i); xs.push(x); ys.push(y); adj.push([]); }
    return i;
  };

  for (const el of elements) {
    const t = el.tags || {};
    const type = t.highway;
    if (el.type !== "way" || !type || !el.geometry || !el.nodes) continue;
    const mult = WALKABLE[type];
    if (!mult || t.access === "private" || t.foot === "no") continue;
    const stairs = type === "steps";
    const noWheels = stairs || t.wheelchair === "no";
    const name = t.name || null;
    const pts = el.geometry.map(toXY);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (!(len > 0)) continue;
      const a = nodeAt(el.nodes[i - 1], ax, ay), b = nodeAt(el.nodes[i], bx, by);
      const edge = { w: len, c: len * mult, stairs, noWheels, name };
      adj[a].push({ to: b, ...edge });
      adj[b].push({ to: a, ...edge });
    }
  }

  // Connected components, so we only ever snap to nodes that can actually be walked between
  const comp = new Int32Array(xs.length).fill(-1);
  const sizes = [];
  for (let s = 0; s < xs.length; s++) {
    if (comp[s] >= 0) continue;
    const id = sizes.length; let n = 0; const stack = [s]; comp[s] = id;
    while (stack.length) { const v = stack.pop(); n++; for (const e of adj[v]) if (comp[e.to] < 0) { comp[e.to] = id; stack.push(e.to); } }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));

  // Uniform grid so snapping a building to the path network is fast
  const CELL = 40, cells = new Map();
  const key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  for (let i = 0; i < xs.length; i++) {
    if (comp[i] !== main) continue;                // ignore stray disconnected fragments
    const k = key(xs[i], ys[i]);
    (cells.get(k) ?? cells.set(k, []).get(k)).push(i);
  }

  function nearestNode(x, y, maxDist = 160) {
    let best = -1, bestD = Infinity;
    for (let r = 1; r * CELL <= maxDist + CELL; r++) {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) {
        for (const n of cells.get(`${i},${j}`) ?? []) {
          const d = Math.hypot(xs[n] - x, ys[n] - y);
          if (d < bestD) { bestD = d; best = n; }
        }
      }
      if (best >= 0 && bestD <= r * CELL) break;   // a closer node can't hide outside this ring
    }
    return bestD <= maxDist ? best : -1;
  }

  // A* over the path graph. avoidStairs makes staircases very expensive rather than
  // impossible, so we still return something (flagged) when no step-free path exists.
  function search(start, goal, { avoidStairs = false } = {}) {
    if (start < 0 || goal < 0) return null;
    if (start === goal) return { nodes: [start], distance: 0, stairs: 0 };
    const n = xs.length;
    const g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
    const heap = [], h = (i) => Math.hypot(xs[i] - xs[goal], ys[i] - ys[goal]);
    const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top; };

    g[start] = 0; push(start, h(start));
    const seen = new Uint8Array(n);
    while (heap.length) {
      const [, v] = pop();
      if (seen[v]) continue;
      seen[v] = 1;
      if (v === goal) break;
      for (const e of adj[v]) {
        const cost = e.c * (avoidStairs && e.noWheels ? STAIR_PENALTY : 1);
        const ng = g[v] + cost;
        if (ng < g[e.to]) { g[e.to] = ng; from[e.to] = v; push(e.to, ng + h(e.to)); }
      }
    }
    if (g[goal] === Infinity) return null;

    const nodes = [];
    for (let v = goal; v >= 0; v = from[v]) nodes.push(v);
    nodes.reverse();
    let distance = 0, stairs = 0;
    for (let i = 1; i < nodes.length; i++) {
      const e = adj[nodes[i - 1]].find((e) => e.to === nodes[i]);
      distance += e.w; if (e.stairs) stairs++;
    }
    return { nodes, distance, stairs };
  }

  // from/to are { x, y } in map meters (y = north), typically a building door.
  function route(from, to, opts = {}) {
    const a = nearestNode(from.x, from.y), b = nearestNode(to.x, to.y);
    const found = search(a, b, opts);
    if (!found) return null;
    const points = found.nodes.map((i) => [xs[i], ys[i]]);
    const names = [];
    for (let i = 1; i < found.nodes.length; i++) {
      const e = adj[found.nodes[i - 1]].find((e) => e.to === found.nodes[i]);
      names.push({ name: e.name, stairs: e.stairs });
    }
    // Walk from the door to the path, and from the path to the destination door
    const pts = [[from.x, from.y], ...points, [to.x, to.y]];
    names.unshift({ name: null, stairs: false }); names.push({ name: null, stairs: false });
    let distance = 0;
    for (let i = 1; i < pts.length; i++) distance += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { points: pts, segments: names, distance, stairs: found.stairs };
  }

  return { route, nearestNode, nodeCount: xs.length, xs, ys };
}

export const walkMinutes = (meters, limited = false) => Math.max(1, Math.round(meters / (limited ? PACE.limited : PACE.normal)));
