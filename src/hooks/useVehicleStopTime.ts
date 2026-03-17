/**
 * Hook to calculate the stop time of a vehicle.
 * Rule: start counting from ignition OFF and never reset on each GPS refresh.
 */
import { parseIgnition } from "@/lib/vehicle-utils";

/**
 * Format the stop duration into a human-readable string
 */
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

interface TraccarPositionWithStopTime {
  deviceId?: number;
  speed: number;
  fixTime?: string;
  deviceTime?: string;
  attributes?: {
    ignition?: boolean;
    motion?: boolean;
    stopped?: number;
    lastStoppedTime?: number;
    lastMotionChange?: number;
    [key: string]: unknown;
  };
}

interface UseVehicleStopTimeResult {
  formattedDuration: string | null;
  loading: boolean;
  stopStartTime: Date | null;
}

const MAX_STOP_MINUTES = 43200; // 30 days
const MIN_MOVING_SPEED_KNOTS = 0.5;

// Persists the moment ignition went OFF per device (module-level state)
const ignitionOffSinceByDevice = new Map<number, number>();

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

/**
 * Parse device/fix time to epoch ms.
 * If tracker time comes without timezone suffix, interpret as Brasília time.
 */
function parsePositionTimeMs(value?: string): number | null {
  if (!value) return null;

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
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  // Accept seconds or milliseconds
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
  ].filter((t): t is number => t !== null);

  // Keep only sane timestamps
  const sane = candidates.filter((t) => t > 0 && t <= nowMs + 5 * 60 * 1000);
  if (sane.length === 0) return null;

  // Most recent stop-related timestamp from tracker
  return Math.max(...sane);
}

function isMoving(position: TraccarPositionWithStopTime): boolean {
  const ignition = parseIgnition(position.attributes?.ignition);
  const motion = position.attributes?.motion;

  // Priority rule: ignition OFF means vehicle is considered stopped for this timer,
  // even if motion attribute is noisy/inconsistent.
  if (ignition === false) return false;
  if (ignition === true) return true;

  // Fallback only when ignition is unknown
  if (motion === true) return true;
  if (position.speed > MIN_MOVING_SPEED_KNOTS) return true;

  return false;
}

function isStopped(position: TraccarPositionWithStopTime): boolean {
  const ignition = parseIgnition(position.attributes?.ignition);
  const motion = position.attributes?.motion;

  if (ignition === false) return true;
  if (ignition === true) return false;

  // Fallback only when ignition is unknown
  if (motion === false) return true;

  return position.speed <= MIN_MOVING_SPEED_KNOTS;
}

/**
 * Stop duration based on ignition OFF event (not on GPS refresh time).
 */
export function useVehicleStopTime({
  position,
}: {
  position: TraccarPositionWithStopTime | null;
}): UseVehicleStopTimeResult {
  if (!position) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  const deviceId = position.deviceId;
  const moving = isMoving(position);
  const stopped = isStopped(position);

  const attrStopMs = getIgnitionOffTimestampMs(position);
  const fallbackPositionMs =
    parsePositionTimeMs(position.deviceTime) ?? parsePositionTimeMs(position.fixTime) ?? Date.now();

  if (typeof deviceId === "number") {
    const persistedStopMs = ignitionOffSinceByDevice.get(deviceId);

    if (moving) {
      // Vehicle moved/ignition on => clear old stop baseline
      ignitionOffSinceByDevice.delete(deviceId);
    } else if (stopped) {
      if (!persistedStopMs) {
        // First known stop moment
        ignitionOffSinceByDevice.set(deviceId, attrStopMs ?? fallbackPositionMs);
      } else if (attrStopMs && attrStopMs < persistedStopMs) {
        // Correct baseline only if tracker gives an older/more accurate OFF timestamp
        ignitionOffSinceByDevice.set(deviceId, attrStopMs);
      }
    }
  }

  // Only render stop timer when actually stopped
  if (!stopped) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  let stopStartMs: number | null = null;

  if (typeof deviceId === "number") {
    stopStartMs = ignitionOffSinceByDevice.get(deviceId) ?? null;
  }

  // If no persisted baseline yet, prefer tracker OFF timestamp (do not keep resetting from GPS time)
  if (!stopStartMs) {
    stopStartMs = attrStopMs ?? fallbackPositionMs;

    if (typeof deviceId === "number" && !ignitionOffSinceByDevice.has(deviceId)) {
      ignitionOffSinceByDevice.set(deviceId, stopStartMs);
    }
  }

  const durationMinutes = Math.floor((Date.now() - stopStartMs) / 60000);
  if (durationMinutes < 0 || durationMinutes > MAX_STOP_MINUTES) {
    return { formattedDuration: null, loading: false, stopStartTime: null };
  }

  return {
    formattedDuration: formatStopDuration(durationMinutes),
    loading: false,
    stopStartTime: new Date(stopStartMs),
  };
}
