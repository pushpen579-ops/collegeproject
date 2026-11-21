/// <reference types="google.maps" />
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  CollisionBehavior,
  InfoWindow,
  Map,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Activity,
  Crosshair,
  LocateFixed,
  Navigation,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { apiRequest, formatDateTime, formatDelayMinutes } from '../lib/api.ts';
import type { TrackedFleetVehicle, UserRole, VehicleStatus } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal, StaggerGrid, StaggerItem } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';

interface LiveTrackingViewProps {
  role: UserRole;
  onRefreshAll: () => Promise<void>;
}

const DEFAULT_INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_INDIA_ZOOM = 5;

function getPinStyle(status: VehicleStatus) {
  if (status === 'On Trip') {
    return { background: '#1D4ED8', borderColor: '#1E3A8A', glyphColor: '#FFFFFF' };
  }
  if (status === 'Available') {
    return { background: '#16A34A', borderColor: '#14532D', glyphColor: '#FFFFFF' };
  }
  return { background: '#D97706', borderColor: '#78350F', glyphColor: '#FFFFFF' };
}

interface VehicleMarkerProps {
  item: TrackedFleetVehicle;
  isSelected: boolean;
  onSelect: (vehicleId: string, marker: google.maps.marker.AdvancedMarkerElement) => void;
}

function FleetVehicleMarker({ item, isSelected, onSelect }: VehicleMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const loc = item.vehicle.lastLocation;
  if (!loc) return null;

  const pinStyle = getPinStyle(item.vehicle.status);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: loc.lat, lng: loc.lng }}
      zIndex={isSelected ? 1000 : 10}
      collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
      title={`${item.vehicle.registrationNumber} — ${item.vehicle.status}`}
      onClick={() => {
        if (marker) {
          onSelect(item.vehicle.id, marker);
        }
      }}
    >
      <Pin
        background={pinStyle.background}
        borderColor={pinStyle.borderColor}
        glyphColor={pinStyle.glyphColor}
        scale={isSelected ? 1.25 : 1.0}
      />
    </AdvancedMarker>
  );
}

function MapViewportController({
  fleetWithLocations,
  selectedVehicleId,
  fitTrigger,
}: {
  fleetWithLocations: TrackedFleetVehicle[];
  selectedVehicleId: string | null;
  fitTrigger: number;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Pan to selected vehicle and render its trail polyline
  useEffect(() => {
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!selectedVehicleId) return;
    const selected = fleetWithLocations.find((f) => f.vehicle.id === selectedVehicleId);
    const loc = selected?.vehicle.lastLocation;
    if (!selected || !loc) return;

    map.panTo({ lat: loc.lat, lng: loc.lng });
    const currentZoom = map.getZoom() ?? DEFAULT_INDIA_ZOOM;
    if (currentZoom < 11) {
      map.setZoom(12);
    }

    const history = selected.vehicle.locationHistory ?? [];
    if (history.length > 1 && typeof google !== 'undefined' && google.maps?.Polyline) {
      polylineRef.current = new google.maps.Polyline({
        path: history.map((pt) => ({ lat: pt.lat, lng: pt.lng })),
        geodesic: true,
        strokeColor: '#1E3A8A',
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, selectedVehicleId, fleetWithLocations]);

  // Fit bounds on explicit request or when locations load
  useEffect(() => {
    if (!map || fitTrigger === 0) return;
    if (fleetWithLocations.length === 0) {
      map.setCenter(DEFAULT_INDIA_CENTER);
      map.setZoom(DEFAULT_INDIA_ZOOM);
      return;
    }

    if (fleetWithLocations.length === 1) {
      const only = fleetWithLocations[0].vehicle.lastLocation!;
      map.panTo({ lat: only.lat, lng: only.lng });
      map.setZoom(12);
      return;
    }

    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    for (const item of fleetWithLocations) {
      const loc = item.vehicle.lastLocation;
      if (loc) {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      }
    }
    map.fitBounds(bounds, 60);
  }, [map, fitTrigger, fleetWithLocations]);

  return null;
}

function MapsApiStatusGuard() {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#081629]/95 p-6 text-center">
        <p className="text-sm font-semibold text-white">
          Unable to load interactive Google Map
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-400">
          Live coordinate records and vehicle statuses remain available in the fleet panel.
        </p>
      </div>
    );
  }

  return null;
}

export function LiveTrackingView({ role, onRefreshAll }: LiveTrackingViewProps) {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '',
  );
  const [keyLoading, setKeyLoading] = useState(!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  const [fleet, setFleet] = useState<TrackedFleetVehicle[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | VehicleStatus | 'LiveGPS'>('All');

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Location update modal state
  const [updatingItem, setUpdatingItem] = useState<TrackedFleetVehicle | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [speedInput, setSpeedInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [sourceType, setSourceType] = useState<'gps' | 'manual'>('manual');
  const [locatingGps, setLocatingGps] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await apiRequest<{ fleet: TrackedFleetVehicle[] }>('/api/tracking');
      setFleet(res.fleet);
    } finally {
      setLoadingFleet(false);
    }
  }, []);

  useEffect(() => {
    void fetchTracking();
  }, [fetchTracking]);

  useEffect(() => {
    if (mapsApiKey) {
      setKeyLoading(false);
      return;
    }
    apiRequest<{ apiKey: string }>('/api/maps/config')
      .then((res) => {
        if (res.apiKey) setMapsApiKey(res.apiKey);
      })
      .catch(() => {
        // Handled cleanly in empty state
      })
      .finally(() => setKeyLoading(false));
  }, [mapsApiKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void fetchTracking();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchTracking]);

  const filteredFleet = useMemo(() => {
    return fleet.filter((item) => {
      if (statusFilter === 'LiveGPS' && !item.vehicle.lastLocation) return false;
      if (
        statusFilter !== 'All' &&
        statusFilter !== 'LiveGPS' &&
        item.vehicle.status !== statusFilter
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${item.vehicle.registrationNumber} ${item.vehicle.manufacturer} ${item.vehicle.model} ${item.driver?.name ?? ''} ${item.activeTrip?.tripCode ?? ''} ${item.vehicle.lastLocation?.locationLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fleet, search, statusFilter]);

  const fleetWithLocations = useMemo(
    () => filteredFleet.filter((item) => Boolean(item.vehicle.lastLocation)),
    [filteredFleet],
  );

  const selectedItem = useMemo(
    () => fleet.find((f) => f.vehicle.id === selectedVehicleId) ?? null,
    [fleet, selectedVehicleId],
  );

  const handleMarkerSelect = useCallback(
    (vehicleId: string, marker: google.maps.marker.AdvancedMarkerElement) => {
      setSelectedVehicleId(vehicleId);
      setSelectedMarker(marker);
    },
    [],
  );

  const openUpdateModal = (item: TrackedFleetVehicle) => {
    setUpdatingItem(item);
    setModalError(null);
    setLatInput(item.vehicle.lastLocation ? String(item.vehicle.lastLocation.lat) : '');
    setLngInput(item.vehicle.lastLocation ? String(item.vehicle.lastLocation.lng) : '');
    setSpeedInput(
      item.vehicle.lastLocation?.speedKmh !== undefined
        ? String(item.vehicle.lastLocation.speedKmh)
        : '',
    );
    setLabelInput(item.vehicle.lastLocation?.locationLabel ?? '');
    setSourceType('manual');
  };

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setModalError('Browser geolocation is not supported on this device.');
      return;
    }
    setLocatingGps(true);
    setModalError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
        if (pos.coords.speed !== null && Number.isFinite(pos.coords.speed)) {
          setSpeedInput(String(Math.round(pos.coords.speed * 3.6 * 10) / 10));
        }
        setSourceType('gps');
        setLocatingGps(false);
      },
      (err) => {
        setLocatingGps(false);
        setModalError(err.message || 'Unable to retrieve device GPS coordinates.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSaveLocation = async (e: FormEvent) => {
    e.preventDefault();
    if (!updatingItem) return;
    setModalError(null);
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setModalError('Enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    setSavingLocation(true);
    try {
      await apiRequest(`/api/tracking/${updatingItem.vehicle.id}/location`, {
        method: 'POST',
        body: JSON.stringify({
          lat,
          lng,
          speedKmh: speedInput.trim() ? Number(speedInput) : undefined,
          locationLabel: labelInput.trim() || undefined,
          source: sourceType,
        }),
      });
      await fetchTracking();
      await onRefreshAll();
      setSelectedVehicleId(updatingItem.vehicle.id);
      setUpdatingItem(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleClearLocation = async (vehicleId: string) => {
    setSavingLocation(true);
    setModalError(null);
    try {
      await apiRequest(`/api/tracking/${vehicleId}/location`, { method: 'DELETE' });
      if (selectedVehicleId === vehicleId) {
        setSelectedVehicleId(null);
        setSelectedMarker(null);
      }
      await fetchTracking();
      await onRefreshAll();
      setUpdatingItem(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to clear location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const trackedCount = fleet.filter((f) => Boolean(f.vehicle.lastLocation)).length;
  const onTripCount = fleet.filter((f) => f.vehicle.status === 'On Trip').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FeatureBanner
        imageSrc="/src/assets/images/fleet_highway_backdrop_1795256358542.jpg"
        imageAlt="FleetFlow commercial logistics hub at dawn"
        title={role === 'driver' ? 'My Live Vehicle Location' : 'Live Fleet Tracking'}
        subtitle="Real-time vehicle GPS coordinates, active trip routes, and live operational status"
      >
        <button
          type="button"
          onClick={() => setAutoRefresh((a) => !a)}
          className={`h-9 px-3.5 text-xs ${autoRefresh ? 'ff-btn-success' : 'ff-btn-secondary'}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              autoRefresh ? 'bg-white animate-pulse' : 'bg-[#142B4A] dark:bg-slate-400'
            }`}
          />
          <span>{autoRefresh ? 'Live Polling (10s)' : 'Polling Paused'}</span>
        </button>

        <button
          type="button"
          onClick={() => setFitTrigger((c) => c + 1)}
          disabled={fleetWithLocations.length === 0}
          className="ff-btn-warning h-9 px-3.5 text-xs"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Fit Fleet</span>
        </button>

        <button
          type="button"
          onClick={() => void fetchTracking()}
          className="ff-btn-royal h-9 px-3.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </FeatureBanner>

      {/* Summary Strip */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.05}>
        <StaggerItem>
          <div className="ff-card p-4 hover:border-[#38BDF8]/40 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Vehicles Monitored
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/25 bg-[#183B60]/80 text-[#38BDF8]">
                <Truck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
              {fleet.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Active fleet telemetry units
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card border-emerald-400/25 p-4 hover:border-emerald-400/45 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Reporting Live GPS
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/15 text-emerald-400">
                <LocateFixed className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-400">
              {trackedCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Broadcasting real-time coordinates
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card border-sky-400/30 p-4 hover:border-[#38BDF8]/50 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Currently On Trip
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#38BDF8]/30 bg-[#2563EB]/25 text-[#38BDF8]">
                <Activity className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#38BDF8]">
              {onTripCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Active highway dispatches
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>

      {/* Main Split Workspace: Interactive Map + Fleet Roster */}
      <ScrollReveal delay={0.08}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-8 ff-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Navigation className="h-4 w-4 text-[#38BDF8]" />
              <span>Live Fleet Map</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
                On Trip
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                Maintenance
              </span>
            </div>
          </div>

          <div className="relative h-[500px] lg:h-[600px] w-full bg-[#081629]">
            {keyLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Initializing map workspace...
              </div>
            ) : !mapsApiKey ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <Truck className="h-8 w-8 text-[#38BDF8] mb-2" />
                <p className="text-sm font-semibold text-white">
                  Google Maps key is unavailable in this environment
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  Enable Google Maps Platform in project settings or restart the preview environment so live map tiles can render.
                </p>
              </div>
            ) : (
              <APIProvider
                apiKey={mapsApiKey}
                libraries={['places', 'marker', 'geometry']}
                language="en"
                region="IN"
              >
                <MapsApiStatusGuard />
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultCenter={DEFAULT_INDIA_CENTER}
                  defaultZoom={DEFAULT_INDIA_ZOOM}
                  gestureHandling="greedy"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%' }}
                  onClick={() => {
                    setSelectedMarker(null);
                  }}
                >
                  <MapViewportController
                    fleetWithLocations={fleetWithLocations}
                    selectedVehicleId={selectedVehicleId}
                    fitTrigger={fitTrigger}
                  />

                  {fleetWithLocations.map((item) => (
                    <FleetVehicleMarker
                      key={item.vehicle.id}
                      item={item}
                      isSelected={selectedVehicleId === item.vehicle.id}
                      onSelect={handleMarkerSelect}
                    />
                  ))}

                  {selectedItem &&
                    selectedItem.vehicle.lastLocation &&
                    selectedMarker && (
                      <InfoWindow
                        anchor={selectedMarker}
                        maxWidth={280}
                        onCloseClick={() => setSelectedMarker(null)}
                      >
                        <div className="p-1 text-slate-900 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono font-bold text-sm">
                              {selectedItem.vehicle.registrationNumber}
                            </span>
                            <span className="font-semibold text-[11px] text-blue-900">
                              {selectedItem.vehicle.status}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            {`${selectedItem.vehicle.manufacturer} ${selectedItem.vehicle.model}`.trim() ||
                              selectedItem.vehicle.rtoOffice ||
                              selectedItem.vehicle.vehicleType}
                          </div>
                          {selectedItem.driver && (
                            <div className="text-slate-700">
                              Driver: <strong>{selectedItem.driver.name}</strong> ({selectedItem.driver.phone})
                            </div>
                          )}
                          {selectedItem.activeTrip && (
                            <div className="rounded bg-slate-100 p-1.5 text-[11px]">
                              <div className="font-semibold">
                                {selectedItem.activeTrip.tripCode}:{' '}
                                {selectedItem.activeTrip.startingLocation} →{' '}
                                {selectedItem.activeTrip.destination}
                              </div>
                              <div className="text-slate-600">
                                Status: {selectedItem.activeTrip.status}
                                {selectedItem.activeTrip.delayMinutes > 0
                                  ? ` · Delay ${formatDelayMinutes(selectedItem.activeTrip.delayMinutes)}`
                                  : ''}
                              </div>
                            </div>
                          )}
                          <div className="font-mono text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                            <div>
                              {selectedItem.vehicle.lastLocation.lat.toFixed(5)},{' '}
                              {selectedItem.vehicle.lastLocation.lng.toFixed(5)}
                              {selectedItem.vehicle.lastLocation.speedKmh !== undefined
                                ? ` · ${selectedItem.vehicle.lastLocation.speedKmh} km/h`
                                : ''}
                            </div>
                            {selectedItem.vehicle.lastLocation.locationLabel && (
                              <div className="font-sans text-slate-700">
                                {selectedItem.vehicle.lastLocation.locationLabel}
                              </div>
                            )}
                            <div>
                              Updated {formatDateTime(selectedItem.vehicle.lastLocation.updatedAt)}
                            </div>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                </Map>

                {!loadingFleet && fleet.length > 0 && trackedCount === 0 && (
                  <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex justify-center">
                    <div className="ff-subcard px-4 py-2.5 text-xs text-slate-200 shadow-lg backdrop-blur-md">
                      No live GPS locations reported yet. Select a vehicle from the panel to broadcast or enter its coordinates.
                    </div>
                  </div>
                )}
              </APIProvider>
            )}
          </div>
        </div>

        {/* Fleet Roster & Location Controls */}
        <div className="lg:col-span-4 flex flex-col ff-card overflow-hidden">
          <div className="border-b border-sky-400/20 p-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicle, driver, trip..."
                className="ff-input h-9 pl-9 pr-3 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'All', label: 'All' },
                  { id: 'LiveGPS', label: 'With GPS' },
                  { id: 'On Trip', label: 'On Trip' },
                  { id: 'Available', label: 'Available' },
                  { id: 'Maintenance', label: 'Maintenance' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.97] ${
                    statusFilter === tab.id
                      ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                      : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 max-h-[520px] overflow-y-auto divide-y divide-sky-400/12">
            {loadingFleet ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading fleet tracking data...
              </div>
            ) : filteredFleet.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {fleet.length === 0
                  ? 'No vehicles added yet'
                  : 'No vehicles match the active search or filter.'}
              </div>
            ) : (
              filteredFleet.map((item) => {
                const loc = item.vehicle.lastLocation;
                const isSelected = selectedVehicleId === item.vehicle.id;
                return (
                  <div
                    key={item.vehicle.id}
                    className={`p-4 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#183B60]/60'
                        : 'hover:bg-[#183B60]/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleId(item.vehicle.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="font-mono font-bold text-sm text-white">
                          {item.vehicle.registrationNumber}
                        </div>
                        <div className="text-slate-400 truncate">
                          {`${item.vehicle.manufacturer} ${item.vehicle.model}`.trim() ||
                            item.vehicle.rtoOffice ||
                            item.vehicle.vehicleType}
                        </div>
                      </button>
                      <StatusLabel status={item.vehicle.status} />
                    </div>

                    <div className="mt-2 space-y-1 text-slate-300">
                      <div>
                        Driver:{' '}
                        <span className="font-medium text-white">
                          {item.driver ? item.driver.name : 'Unassigned'}
                        </span>
                      </div>
                      {item.activeTrip && (
                        <div className="truncate text-[11px] text-[#38BDF8]">
                          {item.activeTrip.tripCode}: {item.activeTrip.startingLocation} →{' '}
                          {item.activeTrip.destination}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-sky-400/15">
                      {loc ? (
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleId(item.vehicle.id)}
                          className="text-left min-w-0 font-mono text-[11px] text-emerald-400 hover:underline"
                        >
                          <div className="truncate">
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            {loc.speedKmh !== undefined ? ` · ${loc.speedKmh} km/h` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatDateTime(loc.updatedAt)}
                          </div>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          No GPS ping yet
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => openUpdateModal(item)}
                        className={`h-8 px-2.5 text-[11px] shrink-0 ${
                          loc ? 'ff-btn-primary' : 'ff-btn-royal'
                        }`}
                      >
                        <LocateFixed className="h-3 w-3" />
                        <span>{loc ? 'Update GPS' : 'Share GPS'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </ScrollReveal>

      {/* Update / Share Live Location Modal */}
      <AnimatePresence>
      {updatingItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="ff-modal w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Update Live Location
                </h2>
                <p className="font-mono text-xs text-slate-400">
                  {updatingItem.vehicle.registrationNumber} ·{' '}
                  {`${updatingItem.vehicle.manufacturer} ${updatingItem.vehicle.model}`.trim() ||
                    updatingItem.vehicle.rtoOffice ||
                    updatingItem.vehicle.vehicleType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpdatingItem(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-lg border border-red-400/35 bg-red-950/60 px-3 py-2 text-xs font-medium text-red-300">
                {modalError}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                disabled={locatingGps}
                onClick={handleUseDeviceGps}
                className="ff-btn-royal h-9 w-full px-4 text-xs"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>
                  {locatingGps ? 'Reading Device GPS...' : 'Use Current Device GPS Location'}
                </span>
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Latitude *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      setSourceType('manual');
                    }}
                    placeholder="e.g. 19.0760"
                    className="ff-input h-9 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Longitude *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={lngInput}
                    onChange={(e) => {
                      setLngInput(e.target.value);
                      setSourceType('manual');
                    }}
                    placeholder="e.g. 72.8777"
                    className="ff-input h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Speed (km/h)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={speedInput}
                  onChange={(e) => setSpeedInput(e.target.value)}
                  placeholder="Optional current speed"
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Checkpoint / Location Note
                </label>
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Optional highway marker, toll plaza, or hub"
                  className="ff-input h-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sky-400/20">
                {updatingItem.vehicle.lastLocation ? (
                  <button
                    type="button"
                    disabled={savingLocation}
                    onClick={() => handleClearLocation(updatingItem.vehicle.id)}
                    className="ff-btn-danger h-9 px-3 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear GPS</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdatingItem(null)}
                    className="ff-btn-secondary h-9 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingLocation}
                    className="ff-btn-primary h-9 px-4 text-xs"
                  >
                    {savingLocation ? 'Saving...' : 'Save Location'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
