import axios from 'axios';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  address: string;
  coordinates: Coordinate;
  components: {
    streetNumber?: string;
    route?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface DistanceMatrixResult {
  originIndex: number;
  destinationIndex: number;
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  status: string;
}

export interface RouteOptimizationResult {
  optimizedOrder: number[];
  totalDistance: number;
  totalDuration: number;
  waypoints: Coordinate[];
}

export class LocationService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Convert address string to coordinates
   */
  async geocode(address: string): Promise<GeocodeResult | null> {
    console.log('🌍 LocationService.geocode:', { address });

    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address,
          key: this.apiKey,
          language: 'pt-BR',
          region: 'br'
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        console.warn('⚠️ Geocoding failed:', response.data.status);
        return null;
      }

      const result = response.data.results[0];
      const components = this.parseAddressComponents(result.address_components);

      const geocodeResult: GeocodeResult = {
        address: result.formatted_address,
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        components
      };

      console.log('✅ Geocoding successful:', {
        address: geocodeResult.address,
        coordinates: geocodeResult.coordinates
      });

      return geocodeResult;
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return null;
    }
  }

  /**
   * Convert coordinates to address
   */
  async reverseGeocode(coordinates: Coordinate): Promise<GeocodeResult | null> {
    console.log('🌍 LocationService.reverseGeocode:', coordinates);

    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${coordinates.lat},${coordinates.lng}`,
          key: this.apiKey,
          language: 'pt-BR',
          region: 'br'
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        console.warn('⚠️ Reverse geocoding failed:', response.data.status);
        return null;
      }

      const result = response.data.results[0];
      const components = this.parseAddressComponents(result.address_components);

      const geocodeResult: GeocodeResult = {
        address: result.formatted_address,
        coordinates,
        components
      };

      console.log('✅ Reverse geocoding successful:', geocodeResult.address);
      return geocodeResult;
    } catch (error) {
      console.error('❌ Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(point1: Coordinate, point2: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(point1: Coordinate, point2: Coordinate): number {
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
  }

  /**
   * Get distance matrix for multiple origins and destinations
   */
  async getDistanceMatrix(
    origins: Coordinate[],
    destinations: Coordinate[],
    travelMode: 'driving' | 'walking' | 'transit' = 'driving'
  ): Promise<DistanceMatrixResult[]> {
    console.log('🗺️ LocationService.getDistanceMatrix:', {
      originsCount: origins.length,
      destinationsCount: destinations.length,
      travelMode
    });

    try {
      const originsParam = origins.map(coord => `${coord.lat},${coord.lng}`).join('|');
      const destinationsParam = destinations.map(coord => `${coord.lat},${coord.lng}`).join('|');

      const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
        params: {
          origins: originsParam,
          destinations: destinationsParam,
          mode: travelMode,
          units: 'metric',
          language: 'pt-BR',
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Distance Matrix API error: ${response.data.status}`);
      }

      const results: DistanceMatrixResult[] = [];
      
      response.data.rows.forEach((row: any, originIndex: number) => {
        row.elements.forEach((element: any, destinationIndex: number) => {
          results.push({
            originIndex,
            destinationIndex,
            distance: element.distance || { text: 'N/A', value: 0 },
            duration: element.duration || { text: 'N/A', value: 0 },
            status: element.status
          });
        });
      });

      console.log('✅ Distance matrix calculated:', { resultsCount: results.length });
      return results;
    } catch (error) {
      console.error('❌ Distance matrix error:', error);
      throw error;
    }
  }

  /**
   * Optimize route for multiple waypoints using nearest neighbor algorithm
   */
  async optimizeRoute(
    startPoint: Coordinate,
    waypoints: Coordinate[],
    endPoint?: Coordinate
  ): Promise<RouteOptimizationResult> {
    console.log('🎯 LocationService.optimizeRoute:', {
      startPoint,
      waypointsCount: waypoints.length,
      hasEndPoint: !!endPoint
    });

    if (waypoints.length === 0) {
      return {
        optimizedOrder: [],
        totalDistance: 0,
        totalDuration: 0,
        waypoints: []
      };
    }

    // For small numbers of waypoints, use brute force
    if (waypoints.length <= 8) {
      return this.optimizeRouteExhaustive(startPoint, waypoints, endPoint);
    }

    // For larger numbers, use nearest neighbor heuristic
    return this.optimizeRouteNearestNeighbor(startPoint, waypoints, endPoint);
  }

  /**
   * Get directions between waypoints
   */
  async getDirections(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[],
    travelMode: 'driving' | 'walking' | 'transit' = 'driving'
  ) {
    console.log('🗺️ LocationService.getDirections:', {
      origin,
      destination,
      waypointsCount: waypoints?.length || 0,
      travelMode
    });

    try {
      const params: any = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: travelMode,
        language: 'pt-BR',
        key: this.apiKey
      };

      if (waypoints && waypoints.length > 0) {
        params.waypoints = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      }

      const response = await axios.get(`${this.baseUrl}/directions/json`, { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Directions API error: ${response.data.status}`);
      }

      console.log('✅ Directions calculated successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Directions error:', error);
      throw error;
    }
  }

  /**
   * Check if a point is within a given radius of another point
   */
  isWithinRadius(center: Coordinate, point: Coordinate, radiusMeters: number): boolean {
    const distance = this.calculateDistance(center, point);
    return distance <= radiusMeters;
  }

  /**
   * Get the bounding box for a given center point and radius
   */
  getBoundingBox(center: Coordinate, radiusMeters: number): {
    northeast: Coordinate;
    southwest: Coordinate;
  } {
    const lat = center.lat;
    const lng = center.lng;
    
    // Approximate degrees per meter
    const latDegreePerMeter = 1 / 111319.9;
    const lngDegreePerMeter = 1 / (111319.9 * Math.cos(lat * Math.PI / 180));
    
    const latOffset = radiusMeters * latDegreePerMeter;
    const lngOffset = radiusMeters * lngDegreePerMeter;
    
    return {
      northeast: {
        lat: lat + latOffset,
        lng: lng + lngOffset
      },
      southwest: {
        lat: lat - latOffset,
        lng: lng - lngOffset
      }
    };
  }

  /**
   * Filter points within a radius
   */
  filterPointsWithinRadius(
    center: Coordinate,
    points: Array<{ coordinates: Coordinate; data: any }>,
    radiusMeters: number
  ) {
    return points.filter(point => 
      this.isWithinRadius(center, point.coordinates, radiusMeters)
    ).map(point => ({
      ...point,
      distanceFromCenter: this.calculateDistance(center, point.coordinates)
    }));
  }

  /**
   * Parse Google address components
   */
  private parseAddressComponents(components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>) {
    const result = {
      streetNumber: '',
      route: '',
      neighborhood: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    };

    components.forEach(component => {
      if (component.types.includes('street_number')) {
        result.streetNumber = component.long_name;
      } else if (component.types.includes('route')) {
        result.route = component.long_name;
      } else if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
        result.neighborhood = component.long_name;
      } else if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
        result.city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        result.state = component.long_name;
      } else if (component.types.includes('country')) {
        result.country = component.long_name;
      } else if (component.types.includes('postal_code')) {
        result.postalCode = component.long_name;
      }
    });

    return result;
  }

  /**
   * Optimize route using exhaustive search (for small waypoint sets)
   */
  private async optimizeRouteExhaustive(
    startPoint: Coordinate,
    waypoints: Coordinate[],
    endPoint?: Coordinate
  ): Promise<RouteOptimizationResult> {
    // Get all permutations
    const permutations = this.getPermutations(waypoints.map((_, i) => i));
    let bestRoute: RouteOptimizationResult | null = null;
    let bestDistance = Infinity;

    for (const permutation of permutations) {
      const route = permutation.map(i => waypoints[i]);
      const routePoints = [startPoint, ...route];
      if (endPoint) routePoints.push(endPoint);

      let totalDistance = 0;
      for (let i = 0; i < routePoints.length - 1; i++) {
        totalDistance += this.calculateDistance(routePoints[i], routePoints[i + 1]);
      }

      if (totalDistance < bestDistance) {
        bestDistance = totalDistance;
        bestRoute = {
          optimizedOrder: permutation,
          totalDistance,
          totalDuration: Math.round(totalDistance / 13.89), // Approximate: 50 km/h average speed
          waypoints: route
        };
      }
    }

    return bestRoute || {
      optimizedOrder: waypoints.map((_, i) => i),
      totalDistance: 0,
      totalDuration: 0,
      waypoints
    };
  }

  /**
   * Optimize route using nearest neighbor heuristic
   */
  private async optimizeRouteNearestNeighbor(
    startPoint: Coordinate,
    waypoints: Coordinate[],
    endPoint?: Coordinate
  ): Promise<RouteOptimizationResult> {
    const visited = new Set<number>();
    const optimizedOrder: number[] = [];
    let currentPoint = startPoint;
    let totalDistance = 0;

    while (visited.size < waypoints.length) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      for (let i = 0; i < waypoints.length; i++) {
        if (!visited.has(i)) {
          const distance = this.calculateDistance(currentPoint, waypoints[i]);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }
      }

      if (nearestIndex !== -1) {
        visited.add(nearestIndex);
        optimizedOrder.push(nearestIndex);
        totalDistance += nearestDistance;
        currentPoint = waypoints[nearestIndex];
      }
    }

    if (endPoint) {
      totalDistance += this.calculateDistance(currentPoint, endPoint);
    }

    return {
      optimizedOrder,
      totalDistance,
      totalDuration: Math.round(totalDistance / 13.89), // Approximate: 50 km/h average speed
      waypoints: optimizedOrder.map(i => waypoints[i])
    };
  }

  /**
   * Get all permutations of an array
   */
  private getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const perms = this.getPermutations(rest);
      for (const perm of perms) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }
}