import { parseIgnition } from "@/lib/vehicle-utils";

export function formatStopDuration(minutes: number): string {
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export interface TraccarPositionWithStopTime {
  deviceId?: number;
  speed: number;
  fixTime?: string;
  deviceTime?: string;
  attributes?: {
    ignition?: unknown;
    motion?: unknown;
    stopped?: unknown;
    lastStoppedTime?: unknown;
    lastMotionChange?: unknown;
    [key: string]: unknown;
  };
}

interface VehicleStopTimeResult {
  formattedDuration: string | null;
  loading: boolean;
  stopStartTime: Date | null;
}

const MAX_STOP_MINUTES = 43200; // 30 days
const MIN_MOVING_SPEED_KNOTS = 0.5;
const ignitionOffSinceByDevice = new Map<number, number>();
const lastStoppedStateByDevice = new Map<number, boolean>();

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

function parseBrasiliaDateMs(value: string): number | null {
  const parsedWithNative = new Date(value).getTime();
  if (!Number.isNaN(parsedWithNative) && hasExplicitTimezone(value)) {
    return parsedWithNative;
  }

  const parsedBrasilia = new Date(`${value}-03:00`).getTime();
  if (!Number.isNaN(parsedBrasilia)) {
    return parsedBrasilia;
  }

  return Number.isNaN(parsedWithNative) ? null : parsedWithNative;
}

function normalizeEpochMs(value: unknown): number | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return normalizeEpochMs(numericValue);
    }

    return parseBrasiliaDateMs(trimmed);
  }

  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  if (value > 1_000_000_000_000) return Math.floor(value);
  if (value > 1_000_000_000) return Math.floor(value * 1000);
  return null;
}

function getIgnitionOffTimestampMs(position: TraccarPositionWithStopTime): number | null {
  const attrs = position.attributes;
  if (!attrs) return null;

  const nowMs = Date.now();
  const candidates = [
    normalizeEpochMs(attrs.lastStoppedTime),
    normalizeEpochMs(attrs.lastMotionChange),
  ].filter((timestamp): timestamp is number => timestamp !== null);

  const saneCandidates = candidates.filter(
    (timestamp) => timestamp > 0 && timestamp <= nowMs + 5 * 60 * 1000,
  );

  if (saneCandidates.length === 0) return null;

  return Math.max(...saneCandidates);
}

function isMoving(position: TraccarPositionWithStopTime): boolean {
  const ignition = parseIgnition(position.attributes?.ignition);
  const motion = position.attributes?.motion;

  if (ignition === false) return false;
  if (ignition === true) return true;
  if (motion === true) return true;

  return position.speed > MIN_MOVING_SPEED_KNOTS;
}

function isStopped(position: TraccarPositionWithStopTime): boolean {
  const ignition = parseIgnition(position.attributes?.ignition);
  const motion = position.attributes?.motion;

  if (ignition === false) return true;
  if (ignition === true) return false;
  if (motion === false) return true;

  return position.speed <= MIN_MOVING_SPEED_KNOTS;
}

export function getVehicleStopTime({
  position,
}: {
  position: TraccarPositionWithStopTime | null;
}): VehicleStopTimeResult {
  if (!position) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  const deviceId = position.deviceId;
  const nowMs = Date.now();
  const moving = isMoving(position);
  const stopped = isStopped(position);
  const attrStopMs = getIgnitionOffTimestampMs(position);
  const previousStopped = typeof deviceId === "number"
    ? lastStoppedStateByDevice.get(deviceId) === true
    : false;

  let stopStartMs = typeof deviceId === "number"
    ? ignitionOffSinceByDevice.get(deviceId) ?? null
    : null;

  if (moving) {
    if (typeof deviceId === "number") {
      ignitionOffSinceByDevice.delete(deviceId);
      lastStoppedStateByDevice.set(deviceId, false);
    }

    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  if (!stopped) {
    if (typeof deviceId === "number") {
      lastStoppedStateByDevice.set(deviceId, false);
    }

    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  if (attrStopMs && (!stopStartMs || attrStopMs < stopStartMs)) {
    stopStartMs = attrStopMs;
  }

  if (!stopStartMs && typeof deviceId === "number" && !previousStopped) {
    stopStartMs = nowMs;
  }

  if (typeof deviceId === "number") {
    lastStoppedStateByDevice.set(deviceId, true);

    if (stopStartMs) {
      ignitionOffSinceByDevice.set(deviceId, stopStartMs);
    }
  }

  if (!stopStartMs) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  const durationMinutes = Math.floor((nowMs - stopStartMs) / 60000);
  if (durationMinutes < 0 || durationMinutes > MAX_STOP_MINUTES) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  return {
    formattedDuration: formatStopDuration(durationMinutes),
    loading: false,
    stopStartTime: new Date(stopStartMs),
  };
}

export function useVehicleStopTime(args: { position: TraccarPositionWithStopTime | null }) {
  return getVehicleStopTime(args);
}
