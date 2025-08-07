export interface BrechoBusiness {
  id: string;
  googlePlaceId: string;
  name: string;
  address: {
    formattedAddress: string;
    streetNumber?: string;
    route?: string;
    neighborhood?: string;
    city: string;
    state: string;
    postalCode?: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  contact: {
    phoneNumber?: string;
    website?: string;
    socialMedia?: {
      facebook?: string;
      instagram?: string;
    };
  };
  businessInfo: {
    rating?: number;
    reviewCount?: number;
    priceLevel?: 1 | 2 | 3 | 4;
    categories: string[];
    businessHours?: BusinessHours[];
    isOpenNow?: boolean;
  };
  media: {
    photos: string[]; // URLs to business photos
    profileImage?: string;
  };
  metadata: {
    discoveredAt: Date;
    lastUpdated: Date;
    dataSource: 'google-places';
    isActive: boolean;
  };
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface BusinessHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  openTime: string; // HH:MM format
  closeTime: string; // HH:MM format
  isClosedAllDay?: boolean;
}

export interface SearchCriteria {
  location: {
    lat: number;
    lng: number;
    radius: number; // meters
  };
  filters?: {
    minRating?: number;
    maxRating?: number;
    minReviewCount?: number;
    priceLevel?: number[];
    openNow?: boolean;
    hasWebsite?: boolean;
    hasPhotos?: boolean;
    openWeekends?: boolean;
    categories?: string[];
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResponse {
  businesses: BrechoBusiness[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchMetadata: {
    searchCenter: { lat: number; lng: number };
    radius: number;
    filtersApplied: Record<string, any>;
    searchDuration: number; // milliseconds
  };
}

export interface MarketAnalytics {
  overview: {
    totalBusinesses: number;
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<string, number>;
  };
  geographic: {
    densityByNeighborhood: Array<{
      name: string;
      count: number;
      avgRating: number;
    }>;
    underservedAreas: Array<{
      name: string;
      populationDensity: string;
      brechoCount: number;
    }>;
  };
  competitive: {
    topRatedBusinesses: BrechoBusiness[];
    marketLeaders: BrechoBusiness[];
    emergingCompetitors: BrechoBusiness[];
  };
}

// Map-specific interfaces
export interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  business: BrechoBusiness;
  markerType: 'business' | 'cluster';
}

export interface MarkerCluster {
  id: string;
  position: { lat: number; lng: number };
  count: number;
  averageRating: number;
  businesses: BrechoBusiness[];
}

export interface RouteInfo {
  stops: BrechoBusiness[];
  totalDistance: string;
  estimatedTime: string;
  routeOptimized: boolean;
  waypoints: Array<{ lat: number; lng: number }>;
  instructions: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

export interface MapViewState {
  center: { lat: number; lng: number };
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  filters: SearchCriteria['filters'];
  visibleLayers: string[];
}