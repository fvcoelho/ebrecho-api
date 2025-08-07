import axios from 'axios';
import { BrechoBusiness, SearchCriteria } from '../models/brecho-business.model';

export interface GooglePlacesConfig {
  apiKey: string;
  language: string;
  region: string;
}

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  business_status?: string;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      close?: { day: number; time: string };
      open?: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      close?: { day: number; time: string };
      open?: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  business_status?: string;
}

export class GooglePlacesService {
  private config: GooglePlacesConfig;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor(config: GooglePlacesConfig) {
    this.config = config;
  }

  /**
   * Search for brechós using Google Places Text Search API
   */
  async searchBrechos(criteria: SearchCriteria): Promise<GooglePlace[]> {
    console.log('🔍 GooglePlacesService.searchBrechos:', {
      location: criteria.location,
      radius: criteria.location.radius,
      filters: criteria.filters
    });

    try {
      const query = this.buildSearchQuery(criteria);
      const location = `${criteria.location.lat},${criteria.location.lng}`;
      const radius = criteria.location.radius;

      console.log('📡 Making Google Places API request:', { query, location, radius });

      const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
        params: {
          query,
          location,
          radius,
          key: this.config.apiKey,
          language: this.config.language,
          region: this.config.region,
          type: 'store'
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message}`);
      }

      const places = response.data.results || [];
      console.log('✅ Google Places API response:', {
        status: response.data.status,
        resultsCount: places.length,
        nextPageToken: !!response.data.next_page_token
      });

      return this.filterPlacesByKeywords(places);
    } catch (error) {
      console.error('❌ Error searching Google Places:', error);
      if (axios.isAxiosError(error)) {
        console.error('API Response:', error.response?.data);
      }
      throw error;
    }
  }

  /**
   * Get detailed information for a specific place
   */
  async getPlaceDetails(placeId: string, fields?: string[]): Promise<PlaceDetails> {
    console.log('🔍 GooglePlacesService.getPlaceDetails:', { placeId, fields });

    const defaultFields = [
      'place_id',
      'name',
      'formatted_address',
      'address_components',
      'geometry',
      'rating',
      'user_ratings_total',
      'price_level',
      'types',
      'formatted_phone_number',
      'international_phone_number',
      'website',
      'opening_hours',
      'photos',
      'business_status'
    ];

    const requestFields = fields || defaultFields;

    try {
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: placeId,
          fields: requestFields.join(','),
          key: this.config.apiKey,
          language: this.config.language
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message}`);
      }

      console.log('✅ Place details retrieved:', {
        placeId,
        name: response.data.result.name,
        hasPhotos: !!response.data.result.photos?.length
      });

      return response.data.result;
    } catch (error) {
      console.error('❌ Error getting place details:', error);
      throw error;
    }
  }

  /**
   * Get photo URL from photo reference
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.config.apiKey}`;
  }

  /**
   * Search for places in multiple pages (if needed)
   */
  async searchWithPagination(criteria: SearchCriteria, maxResults: number = 60): Promise<GooglePlace[]> {
    console.log('🔍 GooglePlacesService.searchWithPagination:', { criteria, maxResults });

    let allPlaces: GooglePlace[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;
    const maxPages = Math.ceil(maxResults / 20); // Google returns max 20 results per page

    do {
      try {
        if (pageCount > 0 && nextPageToken) {
          // Wait for the token to become valid (required by Google)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const response = await this.searchBrechosPage(criteria, nextPageToken);
        
        allPlaces = allPlaces.concat(response.results);
        nextPageToken = response.next_page_token;
        pageCount++;

        console.log(`📄 Page ${pageCount} completed:`, {
          pageResults: response.results.length,
          totalResults: allPlaces.length,
          hasNextPage: !!nextPageToken
        });

      } catch (error) {
        console.error(`❌ Error on page ${pageCount + 1}:`, error);
        break;
      }
    } while (nextPageToken && pageCount < maxPages && allPlaces.length < maxResults);

    const finalResults = allPlaces.slice(0, maxResults);
    console.log('✅ Pagination completed:', {
      totalPages: pageCount,
      totalResults: finalResults.length,
      maxResultsReached: finalResults.length >= maxResults
    });

    return finalResults;
  }

  /**
   * Search a single page with optional page token
   */
  private async searchBrechosPage(criteria: SearchCriteria, pageToken?: string): Promise<{
    results: GooglePlace[];
    next_page_token?: string;
  }> {
    const query = this.buildSearchQuery(criteria);
    const location = `${criteria.location.lat},${criteria.location.lng}`;
    const radius = criteria.location.radius;

    const params: any = {
      query,
      location,
      radius,
      key: this.config.apiKey,
      language: this.config.language,
      region: this.config.region,
      type: 'store'
    };

    if (pageToken) {
      params.pagetoken = pageToken;
    }

    const response = await axios.get(`${this.baseUrl}/textsearch/json`, { params });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message}`);
    }

    return {
      results: this.filterPlacesByKeywords(response.data.results || []),
      next_page_token: response.data.next_page_token
    };
  }

  /**
   * Build search query based on criteria
   */
  private buildSearchQuery(criteria: SearchCriteria): string {
    const baseKeywords = ['brechó', 'brechós', 'second hand', 'segunda mão', 'usado'];
    const additionalKeywords = ['roupa', 'clothing', 'vintage', 'consignment'];
    
    // Combine base keywords with additional terms
    const searchTerms = baseKeywords.concat(additionalKeywords.slice(0, 2));
    
    return searchTerms.join(' OR ');
  }

  /**
   * Filter places to ensure they match brechó criteria
   */
  private filterPlacesByKeywords(places: GooglePlace[]): GooglePlace[] {
    const brechoKeywords = [
      'brechó', 'brechos', 'brecho',
      'segunda mão', 'segunda-mão', 'segundamao',
      'usado', 'usados', 'second hand', 'secondhand',
      'vintage', 'consignment', 'consignação',
      'sebo', 'thrift', 'bazar'
    ];

    return places.filter(place => {
      const searchText = `${place.name} ${place.formatted_address}`.toLowerCase();
      
      // Check if any brechó keyword appears in name or address
      const hasKeyword = brechoKeywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );

      // Check place types for relevant categories
      const relevantTypes = [
        'clothing_store', 'store', 'establishment',
        'point_of_interest', 'shoe_store'
      ];
      
      const hasRelevantType = place.types.some(type => 
        relevantTypes.includes(type)
      );

      const isMatch = hasKeyword && hasRelevantType;
      
      if (isMatch) {
        console.log('✅ Place matches brechó criteria:', {
          name: place.name,
          matchedKeywords: brechoKeywords.filter(kw => searchText.includes(kw.toLowerCase())),
          types: place.types
        });
      }

      return isMatch;
    });
  }

  /**
   * Convert Google Place to BrechoBusiness model
   */
  async convertToBusinessModel(place: GooglePlace, placeDetails?: PlaceDetails): Promise<Partial<BrechoBusiness>> {
    console.log('🔄 Converting Google Place to business model:', place.name);

    // Get detailed information if not provided
    const details = placeDetails || await this.getPlaceDetails(place.place_id);

    // Parse address components
    const addressComponents = this.parseAddressComponents(details.address_components || []);

    // Convert photos to URLs
    const photos = (details.photos || []).slice(0, 5).map(photo => 
      this.getPhotoUrl(photo.photo_reference, 800)
    );

    const business: Partial<BrechoBusiness> = {
      googlePlaceId: place.place_id,
      name: place.name,
      address: {
        formattedAddress: place.formatted_address,
        streetNumber: addressComponents.streetNumber,
        route: addressComponents.route,
        neighborhood: addressComponents.neighborhood,
        city: addressComponents.city || 'Unknown',
        state: addressComponents.state || 'Unknown',
        postalCode: addressComponents.postalCode,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        }
      },
      contact: {
        phoneNumber: details.formatted_phone_number || details.international_phone_number,
        website: details.website
      },
      businessInfo: {
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level && place.price_level >= 1 && place.price_level <= 4 ? place.price_level as 1 | 2 | 3 | 4 : undefined,
        categories: place.types,
        isOpenNow: place.opening_hours?.open_now
      },
      media: {
        photos,
        profileImage: photos[0] // First photo as profile image
      },
      metadata: {
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        dataSource: 'google-places' as const,
        isActive: true
      }
    };

    // Parse business hours if available
    if (details.opening_hours?.periods) {
      const parsedHours = this.parseBusinessHours(details.opening_hours.periods);
      business.businessInfo!.businessHours = parsedHours;
    }

    console.log('✅ Business model created:', {
      name: business.name,
      city: business.address?.city,
      hasPhotos: business.media?.photos.length || 0,
      rating: business.businessInfo?.rating
    });

    return business;
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
        result.state = component.short_name;
      } else if (component.types.includes('postal_code')) {
        result.postalCode = component.long_name;
      }
    });

    return result;
  }

  /**
   * Parse Google business hours format
   */
  private parseBusinessHours(periods: Array<{
    close?: { day: number; time: string };
    open?: { day: number; time: string };
  }>) {
    const businessHours = [];

    for (let day = 0; day < 7; day++) {
      const periodForDay = periods.find(period => period.open?.day === day);
      
      if (periodForDay && periodForDay.open && periodForDay.close) {
        businessHours.push({
          dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          openTime: this.formatGoogleTime(periodForDay.open.time),
          closeTime: this.formatGoogleTime(periodForDay.close.time),
          isClosedAllDay: false
        });
      } else {
        businessHours.push({
          dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          openTime: '',
          closeTime: '',
          isClosedAllDay: true
        });
      }
    }

    return businessHours;
  }

  /**
   * Convert Google time format (e.g., "0900") to HH:MM format
   */
  private formatGoogleTime(time: string): string {
    if (time.length === 4) {
      return `${time.substring(0, 2)}:${time.substring(2)}`;
    }
    return time;
  }
}