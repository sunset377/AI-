// 在完整多边形内检查人物半径，避免旧版矩形拼接产生不可通过的接缝。
export function isInsideStore(x, z, footprint, radius = 0.28) {
  let inside = false;
  let nearest = Infinity;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const [ax, az] = footprint[j], [bx, bz] = footprint[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return inside && nearest >= radius;
}

export function canOccupy(x, z, colliders, footprint, radius = 0.28) {
  if (!isInsideStore(x, z, footprint, radius)) return false;
  return !colliders.some(
    ({ minX, maxX, minZ, maxZ }) =>
      x + radius > minX && x - radius < maxX && z + radius > minZ && z - radius < maxZ,
  );
}
