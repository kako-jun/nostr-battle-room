/**
 * BattleRoomConfig Tests
 *
 * Source: README.md - BattleRoomConfig section
 *
 * ```typescript
 * interface BattleRoomConfig {
 *   gameId: string; // Required: unique game identifier
 *   relays?: string[]; // Nostr relay URLs (default: public relays)
 *   roomExpiry?: number; // Room expiration in ms (default: 600000 = 10 min)
 *   heartbeatInterval?: number; // Heartbeat interval in ms (default: 3000)
 *   disconnectThreshold?: number; // Disconnect threshold in ms (default: 10000)
 *   stateThrottle?: number; // State update throttle in ms (default: 100)
 * }
 * ```
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../types';

describe('BattleRoomConfig defaults (README.md)', () => {
  // "relays?: string[] // Nostr relay URLs (default: public relays)"
  it('relays should default to public relays', () => {
    expect(DEFAULT_CONFIG.relays).toBeDefined();
    expect(Array.isArray(DEFAULT_CONFIG.relays)).toBe(true);
    expect(DEFAULT_CONFIG.relays.length).toBeGreaterThan(0);
  });

  // "roomExpiry?: number // Room expiration in ms (default: 600000 = 10 min)"
  it('roomExpiry should default to 600000ms (10 min)', () => {
    expect(DEFAULT_CONFIG.roomExpiry).toBe(600000);
  });

  // "heartbeatInterval?: number // Heartbeat interval in ms (default: 3000)"
  it('heartbeatInterval should default to 3000ms', () => {
    expect(DEFAULT_CONFIG.heartbeatInterval).toBe(3000);
  });

  // "disconnectThreshold?: number // Disconnect threshold in ms (default: 10000)"
  it('disconnectThreshold should default to 10000ms', () => {
    expect(DEFAULT_CONFIG.disconnectThreshold).toBe(10000);
  });

  // "stateThrottle?: number // State update throttle in ms (default: 100)"
  it('stateThrottle should default to 100ms', () => {
    expect(DEFAULT_CONFIG.stateThrottle).toBe(100);
  });
});
