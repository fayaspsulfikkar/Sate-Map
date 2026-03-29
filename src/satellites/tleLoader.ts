export interface SatelliteData {
  id: string; // NORAD ID
  name: string;
  tle1: string;
  tle2: string;
  type: string; // LEO, MEO, GEO
}

export class TLELoader {
  private readonly CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
  private readonly CACHE_KEY = 'satmap_tle_data';
  private readonly CACHE_TIME_KEY = 'satmap_tle_time';
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  async loadActiveSatellites(): Promise<SatelliteData[]> {
    const cachedTime = localStorage.getItem(this.CACHE_TIME_KEY);
    const now = Date.now();

    if (cachedTime && (now - parseInt(cachedTime)) < this.REFRESH_INTERVAL) {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      if (cachedData) {
        try {
          return JSON.parse(cachedData);
        } catch (e) {
          console.error("Cache parsing failed, refetching...", e);
        }
      }
    }

    // Determine fetch URL dynamically to bypass localhost CORS
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const fetchUrl = isLocalhost ? '/api/tle' : this.CELESTRAK_URL;

    // Fetch new
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch TLE data: ${response.statusText}`);
    }
    
    const text = await response.text();
    const data = this.parseTLE(text);

    // Filter to avoid overwhelming memory initially
    // 3D Elements are incredibly heavy. We limit to 500 to ensure 60fps
    const limitedData = data.slice(0, 500);

    localStorage.setItem(this.CACHE_KEY, JSON.stringify(limitedData));
    localStorage.setItem(this.CACHE_TIME_KEY, now.toString());

    return limitedData;
  }

  private parseTLE(data: string): SatelliteData[] {
    const lines = data.split('\n').map(l => l.trim());
    const result: SatelliteData[] = [];

    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 >= lines.length) break;
      
      const name = lines[i] || 'UNKNOWN';
      const tle1 = lines[i + 1];
      const tle2 = lines[i + 2];
      
      if (!tle1 || !tle2) continue;

      // NORAD ID is in TLE line 1 col 3-7
      let id = tle1.substring(2, 7).trim();
      
      // Simple orbital regieme approximation from Mean Motion (revs per day)
      // Mean motion is columns 53-63 in line 2
      const meanMotionStr = tle2.substring(52, 63).trim();
      const mm = parseFloat(meanMotionStr);
      let type = 'UNKNOWN';
      if (mm > 11.25) type = 'LEO';
      else if (mm < 1.05 && mm > 0.95) type = 'GEO';
      else type = 'MEO';

      result.push({ id, name, tle1, tle2, type });
    }

    return result;
  }
}
