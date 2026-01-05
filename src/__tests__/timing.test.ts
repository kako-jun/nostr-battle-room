/**
 * Timing Tests
 *
 * Source: architecture.md - Timing section
 *
 * | Constant              | Default           | Description           |
 * | --------------------- | ----------------- | --------------------- |
 * | `roomExpiry`          | 600000ms (10 min) | Room expiration       |
 * | `heartbeatInterval`   | 3000ms            | Heartbeat sending     |
 * | `disconnectThreshold` | 10000ms           | Disconnect detection  |
 * | `stateThrottle`       | 100ms             | State update throttle |
 * | `joinTimeout`         | 30000ms           | Join timeout          |
 *
 * Source: protocol.md - Heartbeat section
 *
 * "Every 3 seconds"
 * "If no heartbeat received for 10 seconds, opponent is considered disconnected."
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../types';

describe('Timing Constants (architecture.md)', () => {
  describe('roomExpiry', () => {
    it('should be 600000ms (10 min)', () => {
      expect(DEFAULT_CONFIG.roomExpiry).toBe(600000);
    });

    it('should equal 10 minutes in milliseconds', () => {
      const tenMinutesMs = 10 * 60 * 1000;
      expect(DEFAULT_CONFIG.roomExpiry).toBe(tenMinutesMs);
    });
  });

  describe('heartbeatInterval', () => {
    it('should be 3000ms', () => {
      expect(DEFAULT_CONFIG.heartbeatInterval).toBe(3000);
    });

    it('should equal 3 seconds in milliseconds', () => {
      const threeSecondsMs = 3 * 1000;
      expect(DEFAULT_CONFIG.heartbeatInterval).toBe(threeSecondsMs);
    });
  });

  describe('disconnectThreshold', () => {
    it('should be 10000ms', () => {
      expect(DEFAULT_CONFIG.disconnectThreshold).toBe(10000);
    });

    it('should equal 10 seconds in milliseconds', () => {
      const tenSecondsMs = 10 * 1000;
      expect(DEFAULT_CONFIG.disconnectThreshold).toBe(tenSecondsMs);
    });
  });

  describe('stateThrottle', () => {
    it('should be 100ms', () => {
      expect(DEFAULT_CONFIG.stateThrottle).toBe(100);
    });
  });
});

describe('Timing Relationships (protocol.md)', () => {
  /**
   * Source: protocol.md - Heartbeat section
   *
   * "Every 3 seconds ... If no heartbeat received for 10 seconds"
   *
   * This implies: disconnectThreshold > heartbeatInterval * 3
   * (we need to miss at least 3 heartbeats to detect disconnect)
   */

  it('should detect disconnect after missing ~3 heartbeats', () => {
    const missedHeartbeats = DEFAULT_CONFIG.disconnectThreshold / DEFAULT_CONFIG.heartbeatInterval;
    // 10000 / 3000 = 3.33, meaning ~3 missed heartbeats trigger disconnect
    expect(missedHeartbeats).toBeGreaterThanOrEqual(3);
  });

  it('disconnect threshold should be greater than heartbeat interval', () => {
    expect(DEFAULT_CONFIG.disconnectThreshold).toBeGreaterThan(DEFAULT_CONFIG.heartbeatInterval);
  });
});
