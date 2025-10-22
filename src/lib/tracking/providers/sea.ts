type SeaFetchInput = {
  identifier: string | null; // container or BL or MMSI/IMO
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

export async function fetchSeaPosition(
  input: SeaFetchInput
): Promise<Position> {
  const provider = (
    input.provider ||
    process.env.NEXT_PUBLIC_SEA_PROVIDER ||
    ''
  ).toLowerCase();
  const id = input.identifier || '';

  if (provider === 'marinetraffic') {
    const key = process.env.MARINETRAFFIC_API_KEY;
    if (!key) throw new Error('MarineTraffic API key missing');
    throw new Error(
      'MarineTraffic fetch not wired: provide MMSI/IMO mapping and enable outbound'
    );
  }
  if (provider === 'ais') {
    const key = process.env.AISSTREAM_API_KEY || process.env.AIS_API_KEY;
    if (!key) throw new Error('AISStream API key missing');
    // AISStream is a websocket streaming API. Our current on-demand Refresh
    // endpoint is HTTP-based. To support AISStream properly we should add a
    // short-lived websocket sampler or a background worker to keep last known
    // positions. For now, fail with an actionable message.
    throw new Error(
      'AISStream requires websocket streaming. Switch provider to marinetraffic with MMSI/IMO for Refresh, or allow us to add a streaming sampler.'
    );
  }

  throw new Error('Sea provider not configured');
}
