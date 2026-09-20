// Animated walking navigation on the existing 3D board: route ribbon, a walking guide
// marker, the follow camera, and pause / resume / skip.
// The camera deliberately travels at walking pace so the route is learnable.

const RIBBON_W = 5.5, RIBBON_Y = 1.6;
const CAM_CENTER_MS = 900;        // eased move that centers the bird when travel starts
const CAM_VIEW_MS = 1100;         // eased move when switching between follow and bird's-eye view
const ROUTE_PADDING = 1.35;       // comfortable framing around the route in bird's-eye view
const OVERVIEW_POLAR = 0.5;       // high but tilted, so buildings still read as 3D
const RIBBON_W_WIDE = 13;         // the route is redrawn wider in bird's-eye so it reads from height
const TURN_RATE = 4.5;            // radians/second the bird is allowed to swing when the path turns
// The guide model is built facing local +z, so its yaw is the world heading with no extra offset.
const MODEL_FACING_OFFSET = 0;

export function createNavigator(map, hooks = {}) {
  const THREE = map.THREE;
  const group = new THREE.Group(); group.visible = false; map.scene.add(group);

  const routeMat = new THREE.MeshStandardMaterial({ color: 0xe5751f, roughness: 0.6, transparent: true, opacity: 0.92 });
  const doneMat = new THREE.MeshStandardMaterial({ color: 0x861f41, roughness: 0.6 });
  const routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMat);
  const doneMesh = new THREE.Mesh(new THREE.BufferGeometry(), doneMat);
  doneMesh.position.y = 0.25;                    // sits just above the full route to avoid z-fighting
  group.add(routeMesh, doneMesh);

  // The guide bird is its own object: it marks where the student is even when no route is drawn
  const walker = makeGuide(THREE); walker.visible = false; map.scene.add(walker);
  // A soft ring under the bird, shown only in bird's-eye view so it stays findable when zoomed out
  const birdRing = makeBirdRing(THREE); birdRing.visible = false; map.scene.add(birdRing);

  let state = null;                              // { points, cum, total, dist, speed, paused, from, to }
  let follow = true;                             // keep the bird centered while travelling
  let view = "follow";                           // "follow" | "overview" (bird's-eye)
  let camTween = null;                           // { fromT, toT, fromP, toP, t0, ms } eased camera move
  let followOffset = null;                       // camera offset to restore when leaving bird's-eye
  let speedFactor = 1;                           // travel-speed slider, 0.5x - 3x
  const controls = map.controls;
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // If the user grabs the map mid-transition, stop animating the camera and let them drive
  controls.addEventListener("start", () => { camTween = null; });

  function ribbonGeometry(points, y, width = RIBBON_W) {
    const pos = [], idx = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const nx = -dy * width / 2, ny = dx * width / 2;
      pos.push(p[0] + nx, y, -(p[1] + ny), p[0] - nx, y, -(p[1] - ny));
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function positionAt(dist) {
    const { points, cum } = state;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < dist) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (dist - cum[i - 1]) / seg));
    const a = points[i - 1], b = points[i];
    // Tangent of the path in world axes (map y is north, world z = -y), so yaw can be used directly
    const heading = Math.atan2(b[0] - a[0], -(b[1] - a[1])) + MODEL_FACING_OFFSET;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, heading, seg: i };
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const birdTarget = (pos) => new THREE.Vector3(pos.x, 12, -pos.y);

  // Start of travel: glide the camera until the bird is centered, keeping the user's
  // current viewing angle and distance. Reduced motion jumps straight there instead.
  function moveCamera(toTarget, toPos, ms) {
    if (reducedMotion() || ms <= 0) {            // reduced motion / teleport: cut, don't animate
      controls.target.copy(toTarget);
      map.camera.position.copy(toPos);
      camTween = null;
      return;
    }
    camTween = {
      fromT: controls.target.clone(), toT: toTarget.clone(),
      fromP: map.camera.position.clone(), toP: toPos.clone(),
      t0: performance.now(), ms,
    };
  }

  function centerOnBird(pos, ms = CAM_CENTER_MS) {
    const to = birdTarget(pos);
    const offset = followOffset ?? map.camera.position.clone().sub(controls.target);  // preserve orbit + zoom
    moveCamera(to, to.clone().add(offset), ms);
  }

  // Bird's-eye: pull up and out far enough to frame the whole route inside the part of the
  // screen the panels leave clear. Rather than deriving screen offsets by hand (easy to get the
  // sign wrong), we frame with a trial camera, measure where the route actually lands in pixels,
  // and correct. Two passes converge well within a pixel or two.
  let lastFraming = null;                        // recorded for debugState(), so framing is inspectable
  function frameRoute() {
    const { points } = state;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const center = new THREE.Vector3((x0 + x1) / 2, 0, -(y0 + y1) / 2);

    const w = Math.max(1, map.renderer.domElement.clientWidth);
    const h = Math.max(1, map.renderer.domElement.clientHeight);
    const insets = hooks.getInsets?.() ?? { left: 0, right: 0, top: 0, bottom: 0 };
    // The rectangle of screen the UI leaves clear, with a comfortable margin
    const pad = 24;
    const clear = {
      left: Math.min(insets.left, w * 0.4) + pad,
      right: w - Math.min(insets.right, w * 0.4) - pad,
      top: Math.min(insets.top, h * 0.4) + pad,
      bottom: h - Math.min(insets.bottom, h * 0.4) - pad,
    };
    const clearW = Math.max(80, clear.right - clear.left);
    const clearH = Math.max(80, clear.bottom - clear.top);
    const wantCx = (clear.left + clear.right) / 2, wantCy = (clear.top + clear.bottom) / 2;

    const az = Math.atan2(map.camera.position.x - controls.target.x, map.camera.position.z - controls.target.z);
    const aspect = Number.isFinite(map.camera.aspect) && map.camera.aspect > 0 ? map.camera.aspect : w / h;
    const fov = map.camera.fov * Math.PI / 180;
    const spanX = x1 - x0, spanY = y1 - y0;
    let dist = Math.max(spanY / Math.cos(OVERVIEW_POLAR), spanX / aspect, 120) / (2 * Math.tan(fov / 2)) * ROUTE_PADDING;
    if (!Number.isFinite(dist)) dist = 1500;

    const cam = map.camera.clone();
    cam.aspect = aspect;
    let target = center.clone();
    const place = () => {
      cam.position.set(
        target.x + dist * Math.sin(OVERVIEW_POLAR) * Math.sin(az),
        target.y + dist * Math.cos(OVERVIEW_POLAR),
        target.z + dist * Math.sin(OVERVIEW_POLAR) * Math.cos(az));
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
    };
    const screenBox = () => {
      let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
      const v = new THREE.Vector3();
      for (const [px, py] of points) {
        v.set(px, 1.6, -py).project(cam);
        const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
        sx0 = Math.min(sx0, sx); sx1 = Math.max(sx1, sx);
        sy0 = Math.min(sy0, sy); sy1 = Math.max(sy1, sy);
      }
      return { sx0, sy0, sx1, sy1 };
    };

    for (let pass = 0; pass < 3; pass++) {
      place();
      const b = screenBox();
      const boxW = Math.max(1, b.sx1 - b.sx0), boxH = Math.max(1, b.sy1 - b.sy0);
      // Scale distance so the route fits the clear rectangle
      const grow = Math.max(boxW / clearW, boxH / clearH);
      if (pass < 2) dist = Math.min(controls.maxDistance, Math.max(controls.minDistance, dist * grow));
      place();
      const b2 = screenBox();
      // Then slide the look-at point so the route sits in the middle of that rectangle
      const dxPx = wantCx - (b2.sx0 + b2.sx1) / 2;
      const dyPx = wantCy - (b2.sy0 + b2.sy1) / 2;
      if (Math.abs(dxPx) < 1 && Math.abs(dyPx) < 1 && grow < 1.02) break;
      const right = new THREE.Vector3(), up = new THREE.Vector3();
      cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      const worldPerPixel = 2 * dist * Math.tan(fov / 2) / h;
      // Moving the target against the pixel error brings the route toward the clear centre
      target.addScaledVector(right, -dxPx * worldPerPixel);
      target.addScaledVector(up, dyPx * worldPerPixel);
    }
    place();
    const final = screenBox();
    lastFraming = {
      insets, clear: { ...clear },
      routeOnScreen: { x0: Math.round(final.sx0), x1: Math.round(final.sx1), y0: Math.round(final.sy0), y1: Math.round(final.sy1) },
      dist: Math.round(dist),
    };
    return { target, position: cam.position.clone() };
  }

  function setView(next) {
    if (!state || next === view) return view;
    view = next;
    if (view === "overview") {
      followOffset = map.camera.position.clone().sub(controls.target);   // remember the follow framing
      setRibbonWidth(RIBBON_W_WIDE);             // thin lines vanish from this height
      birdRing.visible = true;
      const { target, position } = frameRoute();
      moveCamera(target, position, CAM_VIEW_MS);
    } else {
      setRibbonWidth(RIBBON_W);
      birdRing.visible = false;
      centerOnBird(positionAt(state.dist), CAM_VIEW_MS);
      followOffset = null;
    }
    hooks.onViewChange?.(view);
    return view;
  }

  // While travelling, move target and camera by the same delta: the bird stays centered and
  // the user keeps full control of orbit and zoom (OrbitControls owns the offset).
  function updateCamera(pos) {
    if (camTween) {
      const k = Math.min(1, (performance.now() - camTween.t0) / camTween.ms), e = ease(k);
      controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
      map.camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
      if (k >= 1) camTween = null;
      return;                                     // don't fight the easing with tracking
    }
    if (!follow || view !== "follow") return;     // bird's-eye stays put while the bird keeps moving
    const to = birdTarget(pos);
    const delta = to.clone().sub(controls.target);
    controls.target.add(delta);
    map.camera.position.add(delta);
  }

  function setRibbonWidth(width) {
    if (!state) return;
    const done = doneMesh.geometry.drawRange.count;
    routeMesh.geometry.dispose(); doneMesh.geometry.dispose();
    routeMesh.geometry = ribbonGeometry(state.points, RIBBON_Y, width);
    doneMesh.geometry = ribbonGeometry(state.points, RIBBON_Y, width);
    doneMesh.geometry.setDrawRange(0, done);
  }

  map.onFrame((dt, time) => {
    walker.userData.wings(time);
    if (birdRing.visible) {                      // gentle pulse so the eye catches it from height
      birdRing.position.set(walker.position.x, 1.8, walker.position.z);
      const k = 1 + Math.sin(time * 2.4) * 0.08;
      birdRing.scale.set(k, 1, k);
    }
    if (!state) return;
    // Progress is distance along the route, so changing speed mid-trip never makes the bird jump
    if (!state.paused) state.dist = Math.min(state.total, state.dist + state.speed * speedFactor * dt);
    const pos = positionAt(state.dist);
    walker.position.set(pos.x, 15 + Math.sin(time * 4) * 1.2, -pos.y);
    // Ease the yaw toward the path tangent (shortest way round) so corners don't snap
    let d = pos.heading - walker.rotation.y;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    walker.rotation.y += d * Math.min(1, dt * TURN_RATE);
    doneMesh.geometry.setDrawRange(0, Math.max(0, pos.seg * 6));
    updateCamera(pos);

    hooks.onProgress?.({ done: state.dist, total: state.total, remaining: Math.max(0, state.total - state.dist), paused: state.paused });
    if (state.dist >= state.total) finish();
  });

  function finish() {
    const { to, minutes } = state;
    state = null;
    follow = false;                 // travel over: stop tracking and leave the camera where it is
    camTween = null; view = "follow"; followOffset = null;
    birdRing.visible = false;
    hooks.onViewChange?.("follow");
    group.visible = false;
    controls.autoRotate = walker.userData.autoRotate;
    hooks.onArrive?.(to, minutes);
  }

  return {
    get active() { return !!state; },
    get paused() { return !!state?.paused; },

    /** route: { points, distance } from routing.route() */
    start({ route, from, to, minutes }) {
      const points = route.points;
      const cum = [0];
      for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
      const total = cum[cum.length - 1];

      routeMesh.geometry.dispose(); doneMesh.geometry.dispose();
      routeMesh.geometry = ribbonGeometry(points, RIBBON_Y);
      doneMesh.geometry = ribbonGeometry(points, RIBBON_Y);
      doneMesh.geometry.setDrawRange(0, 0);
      group.visible = true;
      setRibbonWidth(view === "overview" ? RIBBON_W_WIDE : RIBBON_W);

      const seconds = reducedMotion() ? 2 : Math.min(42, Math.max(12, total / 22));   // walking pace, not teleporting
      walker.userData.autoRotate = controls.autoRotate;
      controls.autoRotate = false;
      map.cancelFlight();
      follow = true;
      view = "follow"; followOffset = null;      // every trip starts by following the bird
      hooks.onViewChange?.("follow");
      state = { points, cum, total, dist: 0, speed: total / seconds, paused: false, from, to, minutes };

      // Place and aim the bird before it moves, then bring the camera onto it
      const startPos = positionAt(0);
      walker.position.set(startPos.x, 15, -startPos.y);
      walker.rotation.y = startPos.heading;
      walker.visible = true;
      centerOnBird(startPos);
      hooks.onStart?.({ from, to, total, minutes });
    },

    pause() { if (state) { state.paused = true; hooks.onProgress?.({ done: state.dist, total: state.total, remaining: state.total - state.dist, paused: true }); } },
    resume() { if (state) { state.paused = false; } },
    toggle() { if (state) state.paused ? this.resume() : this.pause(); },
    /** Jump to the destination without watching the rest of the walk. */
    skip() { if (state) state.dist = state.total; },
    /** Switch between following the bird and a bird's-eye view of the whole route. */
    setView(next) { return setView(next); },
    toggleView() { return setView(view === "follow" ? "overview" : "follow"); },
    get view() { return view; },
    /** Travel speed multiplier from the slider (0.5x - 3x). Takes effect immediately. */
    setSpeed(factor) { speedFactor = Math.min(3, Math.max(0.5, Number(factor) || 1)); },
    getSpeed() { return speedFactor; },
    stop() {
      if (!state) return;
      controls.autoRotate = walker.userData.autoRotate;
      state = null; follow = false; camTween = null; group.visible = false;
      view = "follow"; followOffset = null; birdRing.visible = false;
      hooks.onViewChange?.("follow");
    },
    /** Read-only snapshot for debugging/tests: where the bird is, which way it faces, what the camera targets. */
    debugState() {
      if (!state) return {
        active: false, routeVisible: group.visible, birdVisible: walker.visible, view,
        bird: { x: walker.position.x, y: walker.position.y, z: walker.position.z, yaw: walker.rotation.y },
        cameraTarget: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      };
      const pos = positionAt(state.dist);
      return {
        active: true, dist: state.dist, total: state.total, paused: state.paused,
        speedFactor, metersPerSecond: state.speed * speedFactor,
        bird: { x: walker.position.x, z: walker.position.z, yaw: walker.rotation.y },
        pathHeading: pos.heading,
        cameraTarget: { x: controls.target.x, z: controls.target.z },
        following: follow, centering: !!camTween, view, framing: lastFraming,
      };
    },

    /**
     * Put the bird at a place immediately — no route, no travel. Used by "Start here".
     * Any trip in progress is dropped and the drawn route is cleared.
     */
    placeBird(place, { center = true } = {}) {
      if (!place) { walker.visible = false; birdRing.visible = false; return; }
      if (state) {                                 // abandon a trip rather than continuing it
        controls.autoRotate = walker.userData.autoRotate;
        state = null;
      }
      follow = false; camTween = null;
      view = "follow"; followOffset = null; birdRing.visible = false;
      group.visible = false;                       // clear the old route line
      hooks.onViewChange?.("follow");

      // Hover just above the building, measured from its real bounds like the flag
      const spot = place.building ? map.markerSpot(place.building) : null;
      const y = (spot?.y ?? 12) + 6;
      walker.position.set(place.x, y, -place.y);
      // Face the middle of campus: a sensible, predictable default
      walker.rotation.y = Math.atan2(-place.x, place.y);
      walker.visible = true;

      if (center) {
        const to = walker.position.clone();
        const offset = map.camera.position.clone().sub(controls.target);
        moveCamera(to, to.clone().add(offset), 0);  // "Start here" is an immediate relocation
      }
    },
    /** Hide the bird and any drawn route. */
    clearRoute() { group.visible = false; },
  };
}

// A small low-poly guide bird (maroon body, orange beak) that walks the route ahead of the camera
function makeGuide(THREE) {
  const g = new THREE.Group();
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, flatShading: true });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 0), mat(0x861f41));
  body.scale.set(1, 0.95, 1.2);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 0), mat(0x9c2a4e));
  head.position.set(0, 7, 6);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 6), mat(0xe5751f, 0.5));
  beak.position.set(0, 6, 11); beak.rotation.x = Math.PI / 2;
  const crest = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 5), mat(0xe5751f, 0.5));
  crest.position.set(0, 12, 4);
  const wingGeo = new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(11, 2, -4), new THREE.Vector3(2, 0, -9)]);
  wingGeo.computeVertexNormals();
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe5751f, roughness: 0.7, side: THREE.DoubleSide, flatShading: true });
  const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.position.set(6, 2, 0);
  const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.set(-6, 2, 0); wingL.scale.x = -1;
  for (const m of [body, head, beak, crest, wingR, wingL]) m.castShadow = true;
  g.add(body, head, beak, crest, wingR, wingL);
  g.userData.wings = (time) => {
    const flap = Math.sin(time * 7) * 0.5;
    wingR.rotation.z = -flap; wingL.rotation.z = flap;
  };
  return g;
}

// Halo on the ground under the bird, shown only in bird's-eye view so it stays easy to spot
function makeBirdRing(THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xe5751f, transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(16, 24, 32), mat);
  ring.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: 0xf6c98a, transparent: true, opacity: 0.35, depthWrite: false }));
  core.rotation.x = -Math.PI / 2;
  g.add(ring, core);
  g.renderOrder = 2;
  return g;
}
