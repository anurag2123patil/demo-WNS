// src/utils/secureGeoServerFetch.ts
// Wraps fetch() with X-Map-Token header for GeoServer requests.
// Handles 401 by refreshing the token and retrying once.

// import { mapTokenService } from '@/services/MapTokenService';
import { mapTokenService } from './Maptokenservice';

export async function secureGeoServerFetch(
  url: string,
  authToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const mapToken = await mapTokenService.getValidMapToken(authToken);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'X-Map-Token': mapToken,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });

  // On 401, clear old token, get a fresh one, and retry once
  if (response.status === 401) {
    console.warn('🔑 Map token expired — refreshing and retrying...');
    mapTokenService.clearToken();

    const freshToken = await mapTokenService.fetchMapToken(authToken);
    const retryHeaders = { ...headers, 'X-Map-Token': freshToken };
    return fetch(url, { ...options, headers: retryHeaders });
  }

  return response;
}