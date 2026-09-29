export interface GeoPoint { lat: number; lon: number; ele?: number; time?: number }
export interface TrackPoint extends GeoPoint { distance: number; index: number; segment: number }
export interface Waypoint extends GeoPoint { name: string }
export interface Track {
  schemaVersion: 1;
  id: string;
  name: string;
  filename: string;
  importedAt: number;
  kind: 'track' | 'route';
  segments: TrackPoint[][];
  waypoints: Waypoint[];
  stats: { distance: number; ascent: number | null; descent: number | null; min: number | null; max: number | null; duration: number | null; count: number; elevationCount: number };
  warnings: string[];
  demo?: boolean;
}
export interface StoredTrack { track: Track; xml: string; hash: string; original?: Blob }
export interface LocationFix extends GeoPoint { accuracy: number; timestamp: number; source: 'simulation' | 'browser' | 'android'; crs: 'WGS84' }
export interface LocationAdapter { start(onFix: (fix: LocationFix) => void, onError: (message: string) => void): void; stop(): void }
