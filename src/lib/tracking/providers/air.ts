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
  const id = input.identifier || '';

  // Placeholder adapters. Implement one and set env keys to enable.
  // Example: OpenSky (basic auth) by callsign/icao24; AeroDataBox by flight number.
  if (provider === 'opensky') {
    const user = process.env.OPENSKY_USER;
    const pass = process.env.OPENSKY_PASS;
    if (!user || !pass) throw new Error('OpenSky credentials missing');
    // NOTE: Implement actual fetch here, mapping id->callsign.
    // Returning a dummy error for now to avoid external calls in dev.
    throw new Error(
      'OpenSky fetch not wired: provide callsign mapping and enable outbound'
    );
  }
  if (provider === 'aerodatabox') {
    const key = process.env.AERODATABOX_API_KEY;
    if (!key) throw new Error('AeroDataBox API key missing');
    throw new Error(
      'AeroDataBox fetch not wired: provide flight number mapping and enable outbound'
    );
  }

  throw new Error('Air provider not configured');
}
