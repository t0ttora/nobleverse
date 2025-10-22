type AirFetchInput = {
  identifier: string | null;
  provider?: string | null;
  meta?: any;
};

export type Position = {
  lat: number;
  lon: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  provider?: string | null;
};

export async function fetchAirPosition(
  input: AirFetchInput
): Promise<Position> {
  const provider = (
    input.provider ||
    process.env.NEXT_PUBLIC_AIR_PROVIDER ||
    ''
  ).toLowerCase();
  const flight = (input.identifier || '').trim().toUpperCase();

  if (!flight) throw new Error('Flight identifier is required');

  // Adapter: AeroDataBox via RapidAPI (recommended)
  if (provider === 'aerodatabox') {
    const rapidKey = process.env.AERODATABOX_RAPIDAPI_KEY;
    const rapidHost =
      process.env.AERODATABOX_RAPIDAPI_HOST || 'aerodatabox.p.rapidapi.com';
    if (!rapidKey) throw new Error('AeroDataBox RapidAPI key missing');

    // Try Flight Status (nearest day) by number. We'll request airport locations
    // and approximate current position along route by scheduled times.
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;

    // Endpoint candidates: prefer specific date; fall back to nearest day
    const urls = [
      `https://${rapidHost}/flights/number/${encodeURIComponent(
        flight
      )}/${date}?withLeg=true&withLocation=true`,
      `https://${rapidHost}/flights/number/${encodeURIComponent(
        flight
      )}?withLeg=true&withLocation=true`
    ];

    let data: any = null;
    let lastErr: any = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'x-rapidapi-key': rapidKey,
            'x-rapidapi-host': rapidHost
          }
        });
        if (!res.ok) {
          lastErr = new Error(`AeroDataBox HTTP ${res.status}`);
          continue;
        }
        data = await res.json();
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data) throw lastErr || new Error('AeroDataBox returned no data');

    const flights: any[] = Array.isArray(data) ? data : data.flights || [];
    if (!flights.length) throw new Error('Flight not found');
    const f = flights[0];

    // Extract airport coordinates; schema may vary, check nested fields safely
    const dep = f.departure || f.dep || {};
    const arr = f.arrival || f.arr || {};
    const depLoc = dep.airport?.location || dep.location || {};
    const arrLoc = arr.airport?.location || arr.location || {};
    const depLat = Number(depLoc.lat || depLoc.latitude);
    const depLon = Number(depLoc.lon || depLoc.longitude);
    const arrLat = Number(arrLoc.lat || arrLoc.latitude);
    const arrLon = Number(arrLoc.lon || arrLoc.longitude);

    // If location fields are not available, fail gracefully
    if (
      Number.isNaN(depLat) ||
      Number.isNaN(depLon) ||
      Number.isNaN(arrLat) ||
      Number.isNaN(arrLon)
    ) {
      // Fallback: try to use whichever airport has location, else error
      const lat = !Number.isNaN(depLat) ? depLat : arrLat;
      const lon = !Number.isNaN(depLon) ? depLon : arrLon;
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        return { lat, lon, provider: 'aerodatabox' };
      }
      throw new Error('AeroDataBox response lacked airport coordinates');
    }

    // Compute progress fraction based on times (scheduled/actual)
    const depTimeStr = dep.actualTimeUtc || dep.scheduledTimeUtc || dep.timeUtc;
    const arrTimeStr = arr.actualTimeUtc || arr.scheduledTimeUtc || arr.timeUtc;
    const now = Date.now();
    const t0 = depTimeStr ? Date.parse(depTimeStr) : NaN;
    const t1 = arrTimeStr ? Date.parse(arrTimeStr) : NaN;

    let frac = 0; // 0 at departure, 1 at arrival
    if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 > t0) {
      frac = Math.min(1, Math.max(0, (now - t0) / (t1 - t0)));
    } else if (!Number.isNaN(t0) && now > t0) {
      frac = 0.5; // mid if only departure known
    }

    // Linear interpolate (approximation; good enough for UI breadcrumb)
    const lat = depLat + (arrLat - depLat) * frac;
    const lon = depLon + (arrLon - depLon) * frac;
    return { lat, lon, provider: 'aerodatabox' };
  }

  if (provider === 'opensky') {
    const user = process.env.OPENSKY_USER;
    const pass = process.env.OPENSKY_PASS;
    if (!user || !pass) throw new Error('OpenSky credentials missing');
    throw new Error('OpenSky not wired yet');
  }

  throw new Error('Air provider not configured');
}
