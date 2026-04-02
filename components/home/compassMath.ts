// /components/home/compassMath.ts
export function normalizeHeading(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function getShortestAngleDelta(from: number, to: number): number {
  const start = normalizeHeading(from);
  const end = normalizeHeading(to);
  const delta = end - start;

  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

export function lerpAngle(from: number, to: number, factor: number): number {
  const safeFactor = clamp01(factor);
  const delta = getShortestAngleDelta(from, to);
  return normalizeHeading(from + delta * safeFactor);
}

export function smoothHeading(
  current: number,
  target: number,
  factor: number,
): number {
  const delta = getShortestAngleDelta(current, target);
  const distance = Math.abs(delta);

  if (distance < 0.8) {
    return normalizeHeading(current);
  }

  const adaptiveFactor =
    distance >= 24
      ? Math.max(factor, 0.24)
      : distance >= 10
        ? Math.max(factor, 0.18)
        : Math.max(factor, 0.1);

  const next = lerpAngle(current, target, adaptiveFactor);

  if (Math.abs(getShortestAngleDelta(next, target)) < 0.8) {
    return normalizeHeading(target);
  }

  return next;
}

export function isReliableHeading(value: number): boolean {
  return Number.isFinite(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}