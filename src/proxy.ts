/**
 * nostr-battle-room - Proxy Support
 * Configure WebSocket to work through HTTP/HTTPS proxies
 *
 * Call configureProxy() before creating any BattleRoom instances.
 * Reads proxy URL from environment variables:
 *   - HTTPS_PROXY
 *   - HTTP_PROXY
 *   - ALL_PROXY
 *
 * @example
 * ```typescript
 * import { configureProxy } from 'nostr-battle-room';
 *
 * // Call once at startup (Node.js only)
 * configureProxy();
 *
 * // Now create rooms as usual
 * const room = new BattleRoom({ gameId: 'my-game' });
 * ```
 */

import { useWebSocketImplementation } from 'nostr-tools/pool';

let proxyConfigured = false;

/**
 * Get proxy URL from environment variables
 */
function getProxyUrl(): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
}

/**
 * Check if running in Node.js environment
 */
function isNode(): boolean {
  return (
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null
  );
}

/**
 * Configure WebSocket to use proxy from environment variables.
 * Must be called before connecting to any relays.
 *
 * In Node.js: Sets up proxy-aware WebSocket if HTTPS_PROXY/HTTP_PROXY is set
 * In browser: No-op (browsers handle proxies at OS/network level)
 *
 * @returns true if proxy was configured, false otherwise
 */
export function configureProxy(): boolean {
  if (proxyConfigured) {
    return false;
  }

  if (!isNode()) {
    // Browser environment - no action needed
    proxyConfigured = true;
    return false;
  }

  const proxyUrl = getProxyUrl();

  // Always configure ws for Node.js, even without proxy
  // This ensures WebSocket works in Node.js environment
  try {
    // Dynamic import to avoid bundling issues in browser
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebSocket = require('ws');

    if (proxyUrl) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HttpsProxyAgent } = require('https-proxy-agent');
      const agent = new HttpsProxyAgent(proxyUrl);

      // Create a WebSocket class that uses the proxy agent
      class ProxyWebSocket extends WebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols, { agent });
        }
      }

      useWebSocketImplementation(ProxyWebSocket);
      proxyConfigured = true;
      return true;
    } else {
      // No proxy, but still need ws for Node.js
      useWebSocketImplementation(WebSocket);
      proxyConfigured = true;
      return false;
    }
  } catch {
    // ws or https-proxy-agent not installed
    console.warn(
      'nostr-battle-room: Could not configure WebSocket for Node.js.',
      'Install "ws" package for Node.js support.',
      proxyUrl ? 'Install "https-proxy-agent" for proxy support.' : ''
    );
    proxyConfigured = true;
    return false;
  }
}

/**
 * Reset proxy configuration (mainly for testing)
 */
export function resetProxyConfiguration(): void {
  proxyConfigured = false;
}
