import URLS from '@/api/base_url';

const REFRESH_BUFFER_SECONDS = 60; // refresh 1 min before expiry

class MapTokenService {
  private mapToken: string | null = null;
  private tokenExpiry: number | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async fetchMapToken(authToken: string): Promise<string> {
    console.log('📡 Calling /auth/map-token...');

    const response = await fetch(`${URLS.BASE_URL}/auth/map-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch map token: ${response.status}`);
    }

    const data = await response.json();
    const { map_token, expires_in } = data;

    console.log('✅ Map token received');

    // Store in memory
    this.mapToken = map_token;
    this.tokenExpiry = Date.now() + expires_in * 1000;

    // Schedule automatic refresh
    this.scheduleRefresh(expires_in, authToken);

    return map_token;
  }

  getMapToken(): string | null {
    if (!this.mapToken || !this.tokenExpiry) return null;
    if (Date.now() >= this.tokenExpiry) {
      this.clearToken();
      return null;
    }
    return this.mapToken;
  }

  async getValidMapToken(authToken: string): Promise<string> {
    const existing = this.getMapToken();
    if (existing) return existing;
    return await this.fetchMapToken(authToken);
  }

  private scheduleRefresh(expiresInSeconds: number, authToken: string) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    const refreshAfterMs = Math.max(
      (expiresInSeconds - REFRESH_BUFFER_SECONDS) * 1000,
      10_000
    );

    console.log(`⏰ Map token will auto-refresh in ${refreshAfterMs / 1000}s`);

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.fetchMapToken(authToken);
        console.log('🔄 Map token auto-refreshed');
      } catch (error) {
        console.error('Map token refresh failed:', error);
      }
    }, refreshAfterMs);
  }

  clearToken() {
    this.mapToken = null;
    this.tokenExpiry = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Singleton instance
export const mapTokenService = new MapTokenService();