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
  Building2,
  Compass,
  Crosshair,
  Disc,
  ExternalLink,
  Fuel,
  Hospital,
  Hotel,
  LocateFixed,
  Navigation,
  Phone,
  Pill,
  RefreshCw,
  ShieldAlert,
  Truck,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { apiRequest, formatDateTime } from '../lib/api.ts';
import type { TrackedFleetVehicle, UserRole } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';

export type NearbyCategoryId =
  | 'all'
  | 'petrol_pump'
  | 'police'
  | 'hotel'
  | 'tyre_shop'
  | 'medical'
  | 'hospital'
  | 'garage';

interface CategoryConfig {
  id: NearbyCategoryId;
  label: string;
  shortLabel: string;
  types: string[];
  pinBg: string;
  pinBorder: string;
  badgeClass: string;
  icon: typeof Fuel;
}

const NEARBY_CATEGORIES: CategoryConfig[] = [
  {
    id: 'all',
    label: 'All Services',
    shortLabel: 'All',
    types: [
      'gas_station',
      'police',
      'hotel',
      'motel',
      'lodging',
      'tire_shop',
      'pharmacy',
      'medical_clinic',
      'drugstore',
      'hospital',
      'general_hospital',
      'car_repair',
      'auto_parts_store',
    ],
    pinBg: '#1E3A8A',
    pinBorder: '#172554',
    badgeClass: 'bg-blue-500/15 text-sky-300 border-sky-400/30',
    icon: Compass,
  },
  {
    id: 'petrol_pump',
    label: 'Petrol Pump',
    shortLabel: 'Petrol Pump',
    types: ['gas_station'],
    pinBg: '#D97706',
    pinBorder: '#78350F',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    icon: Fuel,
  },
  {
    id: 'police',
    label: 'Police Station',
    shortLabel: 'Police',
    types: ['police'],
    pinBg: '#1D4ED8',
    pinBorder: '#1E3A8A',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
    icon: ShieldAlert,
  },
  {
    id: 'hotel',
    label: 'Hotel & Stay',
    shortLabel: 'Hotel',
    types: ['hotel', 'motel', 'lodging'],
    pinBg: '#7C3AED',
    pinBorder: '#4C1D95',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
    icon: Hotel,
  },
  {
    id: 'tyre_shop',
    label: 'Tyre Shop',
    shortLabel: 'Tyre Shop',
    types: ['tire_shop'],
    pinBg: '#334155',
    pinBorder: '#0F172A',
    badgeClass: 'bg-[#183B60]/70 text-slate-200 border-sky-400/30',
    icon: Disc,
  },
  {
    id: 'medical',
    label: 'Medical / Pharmacy',
    shortLabel: 'Medical',
    types: ['pharmacy', 'medical_clinic', 'drugstore'],
    pinBg: '#059669',
    pinBorder: '#064E3B',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    icon: Pill,
  },
  {
    id: 'hospital',
    label: 'Hospital',
    shortLabel: 'Hospital',
    types: ['hospital', 'general_hospital'],
    pinBg: '#DC2626',
    pinBorder: '#7F1D1D',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-400/30',
    icon: Hospital,
  },
  {
    id: 'garage',
    label: 'Garage & Repair',
    shortLabel: 'Garage',
    types: ['car_repair', 'auto_parts_store'],
    pinBg: '#EA580C',
    pinBorder: '#7C2D12',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-400/30',
    icon: Wrench,
  },
];

const RADIUS_OPTIONS = [
  { label: '2 km', meters: 2000 },
  { label: '5 km', meters: 5000 },
  { label: '10 km', meters: 10000 },
  { label: '25 km', meters: 25000 },
  { label: '50 km', meters: 50000 },
];

const DEFAULT_INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_INDIA_ZOOM = 5;

interface AnchorLocation {
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  mode: 'fleet' | 'device';
  vehicleId?: string;
}

interface PlaceAttributionItem {
  provider: string;
  providerURI: string | null;
}

interface NearbyPlaceItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  primaryType: string;
  primaryTypeLabel: string;
  categoryId: NearbyCategoryId;
  businessStatus: string;
  googleMapsURI: string;
  attributions: PlaceAttributionItem[];
  rawPlace: google.maps.places.Place;
}

interface PlaceExtraDetails {
  loading: boolean;
  phoneNumber?: string | null;
  isOpenNow?: boolean | null;
  weekdayDescriptions?: string[];
  error?: string;
}

function classifyPlaceCategory(primaryType: string, fallback: NearbyCategoryId): NearbyCategoryId {
  if (primaryType === 'gas_station') return 'petrol_pump';
  if (primaryType === 'police') return 'police';
  if (primaryType === 'hotel' || primaryType === 'motel' || primaryType === 'lodging') {
    return 'hotel';
  }
  if (primaryType === 'tire_shop') return 'tyre_shop';
  if (
    primaryType === 'pharmacy' ||
    primaryType === 'medical_clinic' ||
    primaryType === 'drugstore'
  ) {
    return 'medical';
  }
  if (primaryType === 'hospital' || primaryType === 'general_hospital') return 'hospital';
  if (primaryType === 'car_repair' || primaryType === 'auto_parts_store') return 'garage';
  return fallback === 'all' ? 'garage' : fallback;
}

function getCategoryMeta(id: NearbyCategoryId): CategoryConfig {
  return NEARBY_CATEGORIES.find((c) => c.id === id) ?? NEARBY_CATEGORIES[0];
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err ?? '');
  const upper = msg.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('QUOTA') ||
    upper.includes('429')
  );
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
          Nearby search results require an active Google Maps Places connection.
        </p>
      </div>
    );
  }

  return null;
}

function NearbyViewportController({
  anchor,
  places,
  selectedPlaceId,
  fitTrigger,
}: {
  anchor: AnchorLocation | null;
  places: NearbyPlaceItem[];
  selectedPlaceId: string | null;
  fitTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !anchor) return;
    if (places.length === 0) {
      map.panTo({ lat: anchor.lat, lng: anchor.lng });
      map.setZoom(13);
      return;
    }

    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: anchor.lat, lng: anchor.lng });
    for (const p of places.slice(0, 12)) {
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    map.fitBounds(bounds, 60);
  }, [map, anchor, places, fitTrigger]);

  useEffect(() => {
    if (!map || !selectedPlaceId) return;
    const target = places.find((p) => p.id === selectedPlaceId);
    if (!target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    const z = map.getZoom() ?? 13;
    if (z < 14) {
      map.setZoom(14);
    }
  }, [map, selectedPlaceId, places]);

  return null;
}

function PlaceMarker({
  place,
  isSelected,
  onSelect,
}: {
  place: NearbyPlaceItem;
  isSelected: boolean;
  onSelect: (place: NearbyPlaceItem, marker: google.maps.marker.AdvancedMarkerElement) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const cat = getCategoryMeta(place.categoryId);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: place.lat, lng: place.lng }}
      zIndex={isSelected ? 1000 : 20}
      collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
      title={`${place.name} (${formatDistance(place.distanceMeters)})`}
      onClick={() => {
        if (marker) {
          onSelect(place, marker);
        }
      }}
    >
      <Pin
        background={cat.pinBg}
        borderColor={cat.pinBorder}
        glyphColor="#FFFFFF"
        scale={isSelected ? 1.25 : 0.95}
      />
    </AdvancedMarker>
  );
}

interface InnerWorkspaceProps {
  anchor: AnchorLocation | null;
  category: NearbyCategoryId;
  radiusMeters: number;
  searchNonce: number;
  places: NearbyPlaceItem[];
  searching: boolean;
  searchError: string | null;
  selectedPlaceId: string | null;
  detailsById: Record<string, PlaceExtraDetails>;
  fitTrigger: number;
  onPlacesLoaded: (items: NearbyPlaceItem[]) => void;
  onSearchingChange: (val: boolean) => void;
  onSearchError: (msg: string | null) => void;
  onSelectPlace: (place: NearbyPlaceItem) => void;
  onDetailsLoaded: (placeId: string, details: PlaceExtraDetails) => void;
}

function NearbyMapWorkspace({
  anchor,
  category,
  radiusMeters,
  searchNonce,
  places,
  selectedPlaceId,
  detailsById,
  fitTrigger,
  onPlacesLoaded,
  onSearchingChange,
  onSearchError,
  onSelectPlace,
  onDetailsLoaded,
}: InnerWorkspaceProps) {
  const placesLib = useMapsLibrary('places');
  const geometryLib = useMapsLibrary('geometry');
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const requestIdRef = useRef(0);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  // Clear stale marker anchor when places list changes
  useEffect(() => {
    setSelectedMarker(null);
  }, [places]);

  const fetchExtraDetails = useCallback(
    async (place: NearbyPlaceItem) => {
      if (detailsById[place.id]?.loading || detailsById[place.id]?.phoneNumber !== undefined) {
        return;
      }
      onDetailsLoaded(place.id, { loading: true });
      try {
        await place.rawPlace.fetchFields({
          fields: ['nationalPhoneNumber', 'regularOpeningHours'],
        });
        let isOpenNow: boolean | null = null;
        try {
          if (typeof place.rawPlace.isOpen === 'function') {
            isOpenNow = (await place.rawPlace.isOpen()) ?? null;
          }
        } catch {
          isOpenNow = null;
        }
        onDetailsLoaded(place.id, {
          loading: false,
          phoneNumber: place.rawPlace.nationalPhoneNumber ?? null,
          isOpenNow,
          weekdayDescriptions: place.rawPlace.regularOpeningHours?.weekdayDescriptions ?? [],
        });
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onDetailsLoaded(place.id, {
          loading: false,
          phoneNumber: null,
          error: 'Contact details unavailable',
        });
      }
    },
    [detailsById, onDetailsLoaded],
  );

  // Trigger Places (New) searchNearby whenever anchor, category, radius, or manual refresh changes
  useEffect(() => {
    if (!anchor || !placesLib) return;

    const currentReq = ++requestIdRef.current;
    const catConfig = getCategoryMeta(category);

    const runSearch = async () => {
      onSearchingChange(true);
      onSearchError(null);
      try {
        const { Place, SearchNearbyRankPreference } = placesLib;
        const { places: rawResults } = await Place.searchNearby({
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'primaryType',
            'primaryTypeDisplayName',
            'businessStatus',
            'googleMapsURI',
          ],
          locationRestriction: {
            center: { lat: anchor.lat, lng: anchor.lng },
            radius: Math.min(Math.max(radiusMeters, 500), 50000),
          },
          includedTypes: catConfig.types,
          maxResultCount: 20,
          rankPreference: SearchNearbyRankPreference.DISTANCE,
          language: 'en',
          region: 'IN',
        });

        if (currentReq !== requestIdRef.current) return;

        const originLatLng =
          geometryLib?.spherical && typeof google !== 'undefined' && google.maps?.LatLng
            ? new google.maps.LatLng(anchor.lat, anchor.lng)
            : null;

        const mapped: NearbyPlaceItem[] = (rawResults ?? [])
          .filter((p) => Boolean(p.location))
          .map((p) => {
            const loc = p.location!;
            const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
            const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
            const distanceMeters =
              originLatLng && geometryLib?.spherical && typeof google !== 'undefined'
                ? geometryLib.spherical.computeDistanceBetween(
                    originLatLng,
                    new google.maps.LatLng(lat, lng),
                  )
                : haversineMeters(anchor.lat, anchor.lng, lat, lng);

            const pType = p.primaryType ?? '';
            const mappedCategory = classifyPlaceCategory(pType, category);
            const fallbackUri = `https://www.google.com/maps/dir/?api=1&origin=${anchor.lat},${anchor.lng}&destination=${lat},${lng}`;

            return {
              id: p.id,
              name: p.displayName || 'Unnamed Service Point',
              address: p.formattedAddress || 'Address not listed',
              lat,
              lng,
              distanceMeters,
              primaryType: pType,
              primaryTypeLabel: p.primaryTypeDisplayName || getCategoryMeta(mappedCategory).shortLabel,
              categoryId: mappedCategory,
              businessStatus: p.businessStatus || '',
              googleMapsURI: p.googleMapsURI || fallbackUri,
              attributions: (p.attributions ?? [])
                .filter((a) => Boolean(a.provider))
                .map((a) => ({
                  provider: a.provider ?? '',
                  providerURI: a.providerURI ?? null,
                })),
              rawPlace: p,
            };
          })
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        onPlacesLoaded(mapped);
      } catch (err) {
        if (currentReq !== requestIdRef.current) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onPlacesLoaded([]);
        onSearchError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch nearby roadside services at this location.',
        );
      } finally {
        if (currentReq === requestIdRef.current) {
          onSearchingChange(false);
        }
      }
    };

    void runSearch();
  }, [
    anchor,
    category,
    radiusMeters,
    searchNonce,
    placesLib,
    geometryLib,
    onPlacesLoaded,
    onSearchingChange,
    onSearchError,
  ]);

  const handleMarkerClick = useCallback(
    (place: NearbyPlaceItem, marker: google.maps.marker.AdvancedMarkerElement) => {
      onSelectPlace(place);
      setSelectedMarker(marker);
      void fetchExtraDetails(place);
    },
    [onSelectPlace, fetchExtraDetails],
  );

  // Trigger extra details fetch when selected from the list card too
  useEffect(() => {
    if (selectedPlace) {
      void fetchExtraDetails(selectedPlace);
    }
  }, [selectedPlace, fetchExtraDetails]);

  const activeDetails = selectedPlace ? detailsById[selectedPlace.id] : undefined;

  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={anchor ? { lat: anchor.lat, lng: anchor.lng } : DEFAULT_INDIA_CENTER}
      defaultZoom={anchor ? 13 : DEFAULT_INDIA_ZOOM}
      gestureHandling="greedy"
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
      onClick={() => setSelectedMarker(null)}
    >
      <NearbyViewportController
        anchor={anchor}
        places={places}
        selectedPlaceId={selectedPlaceId}
        fitTrigger={fitTrigger}
      />

      {anchor && (
        <AdvancedMarker
          position={{ lat: anchor.lat, lng: anchor.lng }}
          zIndex={1200}
          title={`${anchor.title} (${anchor.lat.toFixed(4)}, ${anchor.lng.toFixed(4)})`}
        >
          <div className="flex flex-col items-center">
            <div className="rounded-md bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap border border-white">
              {anchor.title}
            </div>
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-900 text-white shadow-md">
              <Truck className="h-3.5 w-3.5" />
            </div>
          </div>
        </AdvancedMarker>
      )}

      {places.map((place) => (
        <PlaceMarker
          key={place.id}
          place={place}
          isSelected={selectedPlaceId === place.id}
          onSelect={handleMarkerClick}
        />
      ))}

      {selectedPlace && selectedMarker && (
        <InfoWindow
          anchor={selectedMarker}
          maxWidth={290}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="p-1 text-slate-900 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-sm leading-snug">{selectedPlace.name}</div>
              <span className="shrink-0 font-mono font-bold text-blue-900">
                {formatDistance(selectedPlace.distanceMeters)}
              </span>
            </div>

            <div className="text-[11px] font-medium text-slate-600">
              {selectedPlace.primaryTypeLabel}
              {activeDetails?.isOpenNow === true && ' · Open now'}
              {activeDetails?.isOpenNow === false && ' · Closed now'}
            </div>

            <div className="text-[11px] text-slate-700 leading-relaxed">
              {selectedPlace.address}
            </div>

            {activeDetails?.phoneNumber && (
              <div className="text-[11px]">
                <a
                  href={`tel:${activeDetails.phoneNumber}`}
                  className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  <span>{activeDetails.phoneNumber}</span>
                </a>
              </div>
            )}

            {selectedPlace.attributions.length > 0 && (
              <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-1">
                Data:{' '}
                {selectedPlace.attributions.map((attr, idx) => (
                  <span key={`${attr.provider}-${idx}`}>
                    {idx > 0 ? ', ' : ''}
                    {attr.providerURI ? (
                      <a
                        href={attr.providerURI}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {attr.provider}
                      </a>
                    ) : (
                      attr.provider
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-1 border-t border-slate-200">
              <a
                href={selectedPlace.googleMapsURI}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-800 hover:underline"
              >
                <Navigation className="h-3 w-3" />
                <span>Open Directions in Google Maps</span>
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}

interface NearbyServicesViewProps {
  role: UserRole;
  initialCategory?: NearbyCategoryId;
  onNavigate?: (tab: string) => void;
}

export function NearbyServicesView({
  role,
  initialCategory,
  onNavigate,
}: NearbyServicesViewProps) {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '',
  );
  const [keyLoading, setKeyLoading] = useState(!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  const [fleet, setFleet] = useState<TrackedFleetVehicle[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [deviceOverride, setDeviceOverride] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [deviceGpsError, setDeviceGpsError] = useState<string | null>(null);

  const [category, setCategory] = useState<NearbyCategoryId>(initialCategory ?? 'all');

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);
  const [radiusMeters, setRadiusMeters] = useState<number>(10000);
  const [searchNonce, setSearchNonce] = useState<number>(0);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const [places, setPlaces] = useState<NearbyPlaceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, PlaceExtraDetails>>({});

  const fetchFleet = useCallback(async () => {
    try {
      const res = await apiRequest<{ fleet: TrackedFleetVehicle[] }>('/api/tracking');
      setFleet(res.fleet);
      setSelectedVehicleId((prev) => {
        if (prev && res.fleet.some((f) => f.vehicle.id === prev)) return prev;
        const firstWithGps = res.fleet.find((f) => Boolean(f.vehicle.lastLocation));
        return firstWithGps?.vehicle.id ?? res.fleet[0]?.vehicle.id ?? '';
      });
    } finally {
      setLoadingFleet(false);
    }
  }, []);

  useEffect(() => {
    void fetchFleet();
  }, [fetchFleet]);

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

  const selectedVehicle = useMemo(
    () => fleet.find((f) => f.vehicle.id === selectedVehicleId) ?? null,
    [fleet, selectedVehicleId],
  );

  const anchor: AnchorLocation | null = useMemo(() => {
    if (deviceOverride) {
      return {
        lat: deviceOverride.lat,
        lng: deviceOverride.lng,
        title: 'Current Device GPS',
        subtitle: `${deviceOverride.lat.toFixed(5)}, ${deviceOverride.lng.toFixed(5)}`,
        mode: 'device',
      };
    }
    if (selectedVehicle?.vehicle.lastLocation) {
      const loc = selectedVehicle.vehicle.lastLocation;
      return {
        lat: loc.lat,
        lng: loc.lng,
        title: selectedVehicle.vehicle.registrationNumber,
        subtitle: loc.locationLabel
          ? `${loc.locationLabel} · Updated ${formatDateTime(loc.updatedAt)}`
          : `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} · Updated ${formatDateTime(loc.updatedAt)}`,
        mode: 'fleet',
        vehicleId: selectedVehicle.vehicle.id,
      };
    }
    return null;
  }, [deviceOverride, selectedVehicle]);

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setDeviceGpsError('Browser geolocation is not supported on this device.');
      return;
    }
    setLocatingDevice(true);
    setDeviceGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceOverride({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocatingDevice(false);
      },
      (err) => {
        setLocatingDevice(false);
        setDeviceGpsError(err.message || 'Unable to retrieve your current device GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handlePlacesLoaded = useCallback((items: NearbyPlaceItem[]) => {
    setPlaces(items);
    setSelectedPlaceId(items[0]?.id ?? null);
  }, []);

  const handleDetailsLoaded = useCallback((placeId: string, details: PlaceExtraDetails) => {
    setDetailsById((prev) => ({ ...prev, [placeId]: details }));
  }, []);

  const handleSelectPlace = useCallback((place: NearbyPlaceItem) => {
    setSelectedPlaceId(place.id);
  }, []);

  const vehiclesWithGps = fleet.filter((f) => Boolean(f.vehicle.lastLocation));

  return (
    <div className="space-y-6">
      {/* Header */}
      <FeatureBanner
        imageSrc="/src/assets/images/bg_nearby_roadside_station_1795256520028.jpg"
        imageAlt="Illuminated highway fuel plaza and truck repair bay at twilight"
        title="Nearby Roadside Services"
        subtitle="Find nearest petrol pumps, police stations, hotels, tyre shops, medical stores, hospitals, and garages around your fleet location"
      >
        <button
          type="button"
          onClick={handleUseDeviceGps}
          disabled={locatingDevice}
          className={`h-9 px-3.5 text-xs ${deviceOverride ? 'ff-btn-success' : 'ff-btn-warning'}`}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          <span>{locatingDevice ? 'Getting GPS...' : 'Use Device GPS'}</span>
        </button>

        <button
          type="button"
          onClick={() => setFitTrigger((c) => c + 1)}
          disabled={!anchor}
          className="ff-btn-secondary h-9 px-3.5 text-xs"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Fit Map</span>
        </button>

        <button
          type="button"
          onClick={() => {
            void fetchFleet();
            setSearchNonce((n) => n + 1);
          }}
          disabled={searching}
          className="ff-btn-royal h-9 px-3.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${searching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </FeatureBanner>

      {/* Fleet Vehicle + Radius + Category Control Panel */}
      <ScrollReveal delay={0.05}>
        <div className="ff-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Fleet Selector */}
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Search Around Fleet Vehicle
            </label>
            <div className="flex items-center gap-2">
              <select
                value={deviceOverride ? '__device__' : selectedVehicleId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__device__') {
                    handleUseDeviceGps();
                    return;
                  }
                  setDeviceOverride(null);
                  setDeviceGpsError(null);
                  setSelectedVehicleId(val);
                }}
                className="ff-select h-9 flex-1 text-xs font-medium"
              >
                {fleet.length === 0 ? (
                  <option value="">No vehicles added yet</option>
                ) : (
                  fleet.map((item) => {
                    const label =
                      `${item.vehicle.manufacturer} ${item.vehicle.model}`.trim() ||
                      item.vehicle.rtoOffice ||
                      item.vehicle.vehicleType;
                    return (
                      <option key={item.vehicle.id} value={item.vehicle.id}>
                        {item.vehicle.registrationNumber} — {label}
                        {item.driver ? ` (${item.driver.name})` : ''}
                        {item.vehicle.lastLocation ? ' · Live GPS' : ' · No GPS yet'}
                      </option>
                    );
                  })
                )}
                {deviceOverride && (
                  <option value="__device__">Current Device GPS Location</option>
                )}
              </select>
            </div>
          </div>

          {/* Search Radius */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Search Radius
            </label>
            <select
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="ff-select h-9 text-xs font-medium"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={opt.meters} value={opt.meters}>
                  Within {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Active Anchor Summary */}
          <div className="md:col-span-3">
            <div className="ff-subcard px-3 py-2 text-xs">
              <div className="text-[11px] font-medium text-slate-400">Active Anchor</div>
              <div className="font-mono font-bold text-[#38BDF8] truncate">
                {anchor ? `${anchor.lat.toFixed(4)}, ${anchor.lng.toFixed(4)}` : 'Waiting for GPS'}
              </div>
            </div>
          </div>
        </div>

        {deviceGpsError && (
          <div className="rounded-lg border border-red-400/35 bg-red-950/60 px-3 py-2 text-xs font-medium text-red-300">
            {deviceGpsError}
          </div>
        )}

        {/* 7 Requested Category Filters + All */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-sky-400/15">
          {NEARBY_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`inline-flex h-8.5 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.97] ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-sm ring-1 ring-[#38BDF8]/40'
                    : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      </ScrollReveal>

      {/* Missing Fleet GPS Prompt */}
      {!loadingFleet && !anchor && (
        <div className="ff-card p-6 text-center">
          <Building2 className="mx-auto h-9 w-9 text-[#38BDF8] mb-2" />
          <h2 className="font-display text-base font-bold text-white">
            {fleet.length === 0
              ? 'No vehicles added yet'
              : vehiclesWithGps.length === 0
                ? 'No fleet GPS location recorded yet'
                : 'Selected vehicle does not have a live GPS location'}
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-xs text-slate-400">
            Select a vehicle with an active GPS location, broadcast coordinates in{' '}
            {role === 'driver' ? 'My Live GPS' : 'Live Tracking'}, or use your current device GPS to inspect nearest roadside assistance.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleUseDeviceGps}
              disabled={locatingDevice}
              className="ff-btn-royal h-9 px-4 text-xs"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              <span>{locatingDevice ? 'Reading Device GPS...' : 'Search Around Device GPS'}</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('tracking')}
                className="ff-btn-primary h-9 px-4 text-xs"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Open {role === 'driver' ? 'My Live GPS' : 'Live Tracking'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Split Map + Nearest Results Workspace */}
      <ScrollReveal delay={0.08}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map */}
        <div className="lg:col-span-7 ff-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Compass className="h-4 w-4 text-[#38BDF8]" />
              <span>
                {anchor ? `Nearest Around ${anchor.title}` : 'Nearby Services Map'}
              </span>
            </div>
            {anchor && (
              <span className="text-[11px] text-slate-400 truncate max-w-xs">
                {anchor.subtitle}
              </span>
            )}
          </div>

          <div className="relative h-[480px] lg:h-[580px] w-full bg-[#081629]">
            {keyLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Initializing nearby services map...
              </div>
            ) : !mapsApiKey ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <Compass className="h-8 w-8 text-[#38BDF8] mb-2" />
                <p className="text-sm font-semibold text-white">
                  Google Maps key is unavailable in this environment
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  Enable Google Maps Platform in project settings so nearby roadside searches can render.
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
                <NearbyMapWorkspace
                  anchor={anchor}
                  category={category}
                  radiusMeters={radiusMeters}
                  searchNonce={searchNonce}
                  places={places}
                  searching={searching}
                  searchError={searchError}
                  selectedPlaceId={selectedPlaceId}
                  detailsById={detailsById}
                  fitTrigger={fitTrigger}
                  onPlacesLoaded={handlePlacesLoaded}
                  onSearchingChange={setSearching}
                  onSearchError={setSearchError}
                  onSelectPlace={handleSelectPlace}
                  onDetailsLoaded={handleDetailsLoaded}
                />
              </APIProvider>
            )}
          </div>
        </div>

        {/* Nearest List */}
        <div className="lg:col-span-5 flex flex-col ff-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sky-400/20 px-4 py-3">
            <div className="text-xs font-semibold text-white">
              {getCategoryMeta(category).label} ({places.length})
            </div>
            <span className="text-[11px] text-slate-400">
              Sorted nearest first
            </span>
          </div>

          {searchError && (
            <div className="m-3 rounded-lg border border-red-400/35 bg-red-950/60 px-3 py-2 text-xs text-red-300">
              {searchError}
            </div>
          )}

          <div className="flex-1 max-h-[540px] overflow-y-auto divide-y divide-sky-400/12">
            {!anchor ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Waiting for a fleet vehicle GPS location or device GPS coordinate to find nearby services.
              </div>
            ) : searching ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Searching nearest {getCategoryMeta(category).label.toLowerCase()} within{' '}
                {RADIUS_OPTIONS.find((r) => r.meters === radiusMeters)?.label}...
              </div>
            ) : places.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No {getCategoryMeta(category).label.toLowerCase()} found within{' '}
                {RADIUS_OPTIONS.find((r) => r.meters === radiusMeters)?.label}. Try increasing the search radius.
              </div>
            ) : (
              places.map((place) => {
                const cat = getCategoryMeta(place.categoryId);
                const CatIcon = cat.icon;
                const isSelected = selectedPlaceId === place.id;
                const details = detailsById[place.id];

                return (
                  <div
                    key={place.id}
                    className={`p-4 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#183B60]/60'
                        : 'hover:bg-[#183B60]/35'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cat.badgeClass}`}
                          >
                            <CatIcon className="h-3 w-3" />
                            <span>{place.primaryTypeLabel}</span>
                          </span>
                          {details?.isOpenNow === true && (
                            <span className="text-[10px] font-semibold text-emerald-400">
                              Open now
                            </span>
                          )}
                          {details?.isOpenNow === false && (
                            <span className="text-[10px] font-semibold text-red-400">
                              Closed
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 font-semibold text-sm text-white">
                          {place.name}
                        </div>
                      </button>

                      <div className="shrink-0 text-right">
                        <div className="font-mono text-sm font-bold text-[#38BDF8]">
                          {formatDistance(place.distanceMeters)}
                        </div>
                        <div className="text-[10px] text-slate-400">away</div>
                      </div>
                    </div>

                    <p className="mt-1 text-slate-300 leading-relaxed">
                      {place.address}
                    </p>

                    {details?.phoneNumber && (
                      <div className="mt-2">
                        <a
                          href={`tel:${details.phoneNumber}`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-200 hover:text-[#38BDF8]"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{details.phoneNumber}</span>
                        </a>
                      </div>
                    )}

                    {place.attributions.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-slate-400">
                        Source:{' '}
                        {place.attributions.map((attr, idx) => (
                          <span key={`${attr.provider}-${idx}`}>
                            {idx > 0 ? ', ' : ''}
                            {attr.providerURI ? (
                              <a
                                href={attr.providerURI}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                {attr.provider}
                              </a>
                            ) : (
                              attr.provider
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-sky-400/15">
                      <button
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        className="ff-btn-secondary h-7 px-2.5 text-[11px]"
                      >
                        {details?.loading ? 'Loading phone & hours...' : 'Focus & Details'}
                      </button>

                      <a
                        href={place.googleMapsURI}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ff-btn-royal h-7 px-2.5 text-[11px]"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </ScrollReveal>
    </div>
  );
}
