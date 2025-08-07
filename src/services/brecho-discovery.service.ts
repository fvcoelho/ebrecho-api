import { PrismaClient } from '@prisma/client';
import { BrechoBusiness, SearchCriteria, SearchResponse, MarketAnalytics } from '../models/brecho-business.model';
import { GooglePlacesService } from './google-places.service';
import { LocationService } from './location.service';
import { AnalyticsService } from './analytics.service';

export class BrechoDiscoveryService {
  private prisma: PrismaClient;
  private googlePlaces: GooglePlacesService;
  private locationService: LocationService;
  private analyticsService: AnalyticsService;

  constructor(
    prisma: PrismaClient,
    googlePlaces: GooglePlacesService,
    locationService: LocationService,
    analyticsService: AnalyticsService
  ) {
    this.prisma = prisma;
    this.googlePlaces = googlePlaces;
    this.locationService = locationService;
    this.analyticsService = analyticsService;
  }

  /**
   * Search for brechós with caching and database storage
   */
  async searchBrechos(criteria: SearchCriteria, promoterId: string): Promise<SearchResponse> {
    console.log('🔍 BrechoDiscoveryService.searchBrechos:', {
      promoterId,
      location: criteria.location,
      filters: criteria.filters
    });

    const startTime = Date.now();
    const searchId = `search_${Date.now()}_${promoterId}`;

    try {
      // First, check if we have cached results in the database
      const cachedResults = await this.getCachedResults(criteria);
      
      let businesses: BrechoBusiness[] = [];
      
      if (cachedResults.length > 0) {
        console.log('✅ Using cached results:', { count: cachedResults.length });
        businesses = cachedResults;
      } else {
        console.log('🔄 Fetching fresh data from Google Places...');
        // Search Google Places
        const googlePlaces = await this.googlePlaces.searchWithPagination(criteria, 60);
        
        // Convert and store in database
        businesses = await this.storeBusinesses(googlePlaces);
        console.log('💾 Stored businesses in database:', { count: businesses.length });
      }

      // Apply additional filters
      const filteredBusinesses = this.applyFilters(businesses, criteria.filters);
      
      // Calculate distances from search center
      const businessesWithDistance = filteredBusinesses.map(business => ({
        ...business,
        distanceFromCenter: this.locationService.calculateDistance(
          criteria.location,
          business.address.coordinates
        )
      }));

      // Sort by distance
      businessesWithDistance.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

      // Apply pagination
      const page = criteria.pagination?.page || 1;
      const limit = criteria.pagination?.limit || 50;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedBusinesses = businessesWithDistance.slice(startIndex, endIndex);

      // Store search results for analytics
      await this.storeSearchResults(searchId, paginatedBusinesses, criteria, promoterId);

      const searchDuration = Date.now() - startTime;

      const response: SearchResponse = {
        businesses: paginatedBusinesses,
        pagination: {
          page,
          limit,
          total: filteredBusinesses.length,
          totalPages: Math.ceil(filteredBusinesses.length / limit)
        },
        searchMetadata: {
          searchCenter: criteria.location,
          radius: criteria.location.radius,
          filtersApplied: criteria.filters || {},
          searchDuration
        }
      };

      console.log('✅ Search completed:', {
        totalFound: filteredBusinesses.length,
        returned: paginatedBusinesses.length,
        duration: `${searchDuration}ms`
      });

      return response;
    } catch (error) {
      console.error('❌ Search error:', error);
      throw error;
    }
  }

  /**
   * Get market analytics for a region
   */
  async getMarketAnalytics(
    region: { city?: string; state?: string; coordinates?: { lat: number; lng: number; radius: number } },
    timeframe: '30d' | '90d' | '1y' = '90d'
  ): Promise<MarketAnalytics> {
    console.log('📊 BrechoDiscoveryService.getMarketAnalytics:', { region, timeframe });

    try {
      // Build query conditions
      const whereConditions: any = { isActive: true };
      
      if (region.city) whereConditions.city = region.city;
      if (region.state) whereConditions.state = region.state;

      if (region.coordinates) {
        // Use bounding box for coordinate-based search
        const bounds = this.locationService.getBoundingBox(
          region.coordinates,
          region.coordinates.radius
        );
        
        whereConditions.latitude = {
          gte: bounds.southwest.lat,
          lte: bounds.northeast.lat
        };
        whereConditions.longitude = {
          gte: bounds.southwest.lng,
          lte: bounds.northeast.lng
        };
      }

      // Get current businesses
      const currentBusinesses = await this.prisma.brechoBusiness.findMany({
        where: whereConditions,
        include: {
          businessHours: true
        }
      });

      // Get historical data for trend analysis
      const periodStart = this.getPeriodStart(timeframe);
      const historicalBusinesses = await this.prisma.brechoBusiness.findMany({
        where: {
          ...whereConditions,
          discoveredAt: { gte: periodStart }
        }
      });

      // Convert to business model format
      const businesses = currentBusinesses.map(this.convertFromDB);
      const historical = historicalBusinesses.map(this.convertFromDB);

      // Generate analytics
      const analytics = await this.analyticsService.generateMarketAnalytics(businesses, region);

      console.log('✅ Market analytics generated:', {
        businessCount: businesses.length,
        historicalCount: historical.length
      });

      return analytics;
    } catch (error) {
      console.error('❌ Analytics error:', error);
      throw error;
    }
  }

  /**
   * Get map data optimized for visualization
   */
  async getMapData(
    bounds: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } },
    zoom: number,
    filters?: SearchCriteria['filters']
  ) {
    console.log('🗺️ BrechoDiscoveryService.getMapData:', { bounds, zoom, filters });

    try {
      // Query businesses within bounds
      const businesses = await this.prisma.brechoBusiness.findMany({
        where: {
          isActive: true,
          latitude: {
            gte: bounds.sw.lat,
            lte: bounds.ne.lat
          },
          longitude: {
            gte: bounds.sw.lng,
            lte: bounds.ne.lng
          }
        }
      });

      const businessModels = businesses.map(this.convertFromDB);
      const filteredBusinesses = this.applyFilters(businessModels, filters);

      // Generate markers or clusters based on zoom level
      const shouldCluster = zoom < 12; // Cluster at lower zoom levels
      
      if (shouldCluster) {
        const clusters = this.generateClusters(filteredBusinesses, zoom);
        return {
          markers: [],
          clusters,
          analytics: {
            densityData: this.analyticsService.generateDensityHeatMap(filteredBusinesses),
            marketGaps: await this.analyticsService.identifyMarketGaps(
              filteredBusinesses,
              { 
                center: {
                  lat: (bounds.ne.lat + bounds.sw.lat) / 2,
                  lng: (bounds.ne.lng + bounds.sw.lng) / 2
                },
                radius: this.locationService.calculateDistance(
                  { lat: bounds.ne.lat, lng: bounds.ne.lng },
                  { lat: bounds.sw.lat, lng: bounds.sw.lng }
                ) / 2
              }
            )
          }
        };
      } else {
        const markers = filteredBusinesses.map(business => ({
          id: business.id,
          position: business.address.coordinates,
          business,
          markerType: 'business' as const
        }));

        return {
          markers,
          clusters: [],
          analytics: {
            densityData: [],
            marketGaps: []
          }
        };
      }
    } catch (error) {
      console.error('❌ Map data error:', error);
      throw error;
    }
  }

  /**
   * Save map view for sharing and collaboration
   */
  async saveMapView(
    promoterId: string,
    mapView: {
      name: string;
      description?: string;
      center: { lat: number; lng: number };
      zoom: number;
      mapType: string;
      filters?: any;
      visibleLayers: string[];
      isPublic?: boolean;
    }
  ) {
    console.log('💾 BrechoDiscoveryService.saveMapView:', { promoterId, name: mapView.name });

    try {
      const shareToken = mapView.isPublic ? this.generateShareToken() : null;

      const savedView = await this.prisma.brechoMapView.create({
        data: {
          promoterId,
          name: mapView.name,
          description: mapView.description,
          centerLat: mapView.center.lat,
          centerLng: mapView.center.lng,
          zoom: mapView.zoom,
          mapType: mapView.mapType,
          filters: mapView.filters || {},
          visibleLayers: mapView.visibleLayers,
          isPublic: mapView.isPublic || false,
          shareToken
        }
      });

      console.log('✅ Map view saved:', { id: savedView.id, shareToken });
      return savedView;
    } catch (error) {
      console.error('❌ Save map view error:', error);
      throw error;
    }
  }

  /**
   * Export search results
   */
  async exportResults(
    promoterId: string,
    searchCriteria: SearchCriteria,
    format: 'csv' | 'excel',
    fields?: string[]
  ) {
    console.log('📊 BrechoDiscoveryService.exportResults:', {
      promoterId,
      format,
      fieldsCount: fields?.length
    });

    try {
      // Create export request record
      const exportRequest = await this.prisma.brechoExportRequest.create({
        data: {
          promoterId,
          format,
          searchCriteria: searchCriteria as any,
          fields: fields || [],
          deliveryMethod: 'download',
          status: 'processing'
        }
      });

      // Get the data to export
      const searchResponse = await this.searchBrechos(searchCriteria, promoterId);
      
      // Generate export file (implementation would depend on chosen library)
      const exportData = this.prepareExportData(searchResponse.businesses, fields);
      const { downloadUrl, fileSize } = await this.generateExportFile(exportData, format);

      // Update export request
      await this.prisma.brechoExportRequest.update({
        where: { id: exportRequest.id },
        data: {
          downloadUrl,
          recordCount: searchResponse.businesses.length,
          fileSize,
          status: 'completed',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      console.log('✅ Export completed:', {
        id: exportRequest.id,
        recordCount: searchResponse.businesses.length,
        fileSize
      });

      return {
        id: exportRequest.id,
        downloadUrl,
        recordCount: searchResponse.businesses.length,
        fileSize
      };
    } catch (error) {
      console.error('❌ Export error:', error);
      throw error;
    }
  }

  /**
   * Check for cached results
   */
  private async getCachedResults(criteria: SearchCriteria): Promise<BrechoBusiness[]> {
    const cacheThresholdHours = 24; // Cache for 24 hours
    const cacheThreshold = new Date(Date.now() - cacheThresholdHours * 60 * 60 * 1000);

    const bounds = this.locationService.getBoundingBox(criteria.location, criteria.location.radius);

    const cachedBusinesses = await this.prisma.brechoBusiness.findMany({
      where: {
        isActive: true,
        lastUpdated: { gte: cacheThreshold },
        latitude: {
          gte: bounds.southwest.lat,
          lte: bounds.northeast.lat
        },
        longitude: {
          gte: bounds.southwest.lng,
          lte: bounds.northeast.lng
        }
      },
      include: {
        businessHours: true
      }
    });

    return cachedBusinesses.map(this.convertFromDB);
  }

  /**
   * Store businesses in database
   */
  private async storeBusinesses(googlePlaces: any[]): Promise<BrechoBusiness[]> {
    const businesses: BrechoBusiness[] = [];

    for (const place of googlePlaces) {
      try {
        const businessData = await this.googlePlaces.convertToBusinessModel(place);
        
        // Check if business already exists
        const existing = await this.prisma.brechoBusiness.findUnique({
          where: { googlePlaceId: place.place_id }
        });

        if (existing) {
          // Update existing business
          const updated = await this.prisma.brechoBusiness.update({
            where: { googlePlaceId: place.place_id },
            data: {
              name: businessData.name!,
              formattedAddress: businessData.address!.formattedAddress,
              latitude: businessData.address!.coordinates.lat,
              longitude: businessData.address!.coordinates.lng,
              rating: businessData.businessInfo?.rating || null,
              reviewCount: businessData.businessInfo?.reviewCount || null,
              lastUpdated: new Date()
            },
            include: { businessHours: true }
          });
          businesses.push(this.convertFromDB(updated));
        } else {
          // Create new business
          const created = await this.prisma.brechoBusiness.create({
            data: {
              googlePlaceId: place.place_id,
              name: businessData.name!,
              formattedAddress: businessData.address!.formattedAddress,
              streetNumber: businessData.address?.streetNumber,
              route: businessData.address?.route,
              neighborhood: businessData.address?.neighborhood,
              city: businessData.address!.city,
              state: businessData.address!.state,
              postalCode: businessData.address?.postalCode,
              latitude: businessData.address!.coordinates.lat,
              longitude: businessData.address!.coordinates.lng,
              phoneNumber: businessData.contact?.phoneNumber,
              website: businessData.contact?.website,
              rating: businessData.businessInfo?.rating || null,
              reviewCount: businessData.businessInfo?.reviewCount || null,
              priceLevel: businessData.businessInfo?.priceLevel || null,
              categories: businessData.businessInfo?.categories || [],
              isOpenNow: businessData.businessInfo?.isOpenNow,
              photos: businessData.media?.photos || [],
              profileImage: businessData.media?.profileImage
            },
            include: { businessHours: true }
          });
          businesses.push(this.convertFromDB(created));
        }
      } catch (error) {
        console.error('❌ Error storing business:', place.name, error);
      }
    }

    return businesses;
  }

  /**
   * Apply filters to businesses
   */
  private applyFilters(businesses: BrechoBusiness[], filters?: SearchCriteria['filters']): BrechoBusiness[] {
    if (!filters) return businesses;

    return businesses.filter(business => {
      // Rating filters
      if (filters.minRating && (!business.businessInfo.rating || business.businessInfo.rating < filters.minRating)) {
        return false;
      }
      if (filters.maxRating && (!business.businessInfo.rating || business.businessInfo.rating > filters.maxRating)) {
        return false;
      }

      // Review count filter
      if (filters.minReviewCount && (!business.businessInfo.reviewCount || business.businessInfo.reviewCount < filters.minReviewCount)) {
        return false;
      }

      // Price level filter
      if (filters.priceLevel && filters.priceLevel.length > 0) {
        if (!business.businessInfo.priceLevel || !filters.priceLevel.includes(business.businessInfo.priceLevel)) {
          return false;
        }
      }

      // Open now filter
      if (filters.openNow && !business.businessInfo.isOpenNow) {
        return false;
      }

      // Has website filter
      if (filters.hasWebsite && !business.contact.website) {
        return false;
      }

      // Has photos filter
      if (filters.hasPhotos && (!business.media.photos || business.media.photos.length === 0)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Store search results for analytics
   */
  private async storeSearchResults(
    searchId: string,
    businesses: any[],
    criteria: SearchCriteria,
    promoterId: string
  ) {
    try {
      const searchResults = businesses.map(business => ({
        searchId,
        businessId: business.id,
        promoterId,
        searchCenter: criteria.location,
        searchRadius: criteria.location.radius,
        filtersApplied: criteria.filters || {},
        distanceFromCenter: business.distanceFromCenter || 0
      }));

      await this.prisma.brechoSearchResult.createMany({
        data: searchResults,
        skipDuplicates: true
      });
    } catch (error) {
      console.error('❌ Error storing search results:', error);
    }
  }

  /**
   * Generate clusters for map visualization
   */
  private generateClusters(businesses: BrechoBusiness[], zoom: number) {
    // Simple grid-based clustering
    const clusterSize = zoom < 8 ? 0.1 : zoom < 10 ? 0.05 : 0.02; // Degrees
    const clusters = new Map<string, any>();

    businesses.forEach(business => {
      const clusterLat = Math.floor(business.address.coordinates.lat / clusterSize) * clusterSize;
      const clusterLng = Math.floor(business.address.coordinates.lng / clusterSize) * clusterSize;
      const clusterKey = `${clusterLat}_${clusterLng}`;

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          id: clusterKey,
          position: { lat: clusterLat, lng: clusterLng },
          count: 0,
          businesses: [],
          totalRating: 0,
          ratingCount: 0
        });
      }

      const cluster = clusters.get(clusterKey)!;
      cluster.count++;
      cluster.businesses.push(business);
      
      if (business.businessInfo.rating) {
        cluster.totalRating += business.businessInfo.rating;
        cluster.ratingCount++;
      }
    });

    return Array.from(clusters.values()).map(cluster => ({
      ...cluster,
      averageRating: cluster.ratingCount > 0 ? cluster.totalRating / cluster.ratingCount : 0
    }));
  }

  /**
   * Convert database record to business model
   */
  private convertFromDB(dbRecord: any): BrechoBusiness {
    return {
      id: dbRecord.id,
      googlePlaceId: dbRecord.googlePlaceId,
      name: dbRecord.name,
      address: {
        formattedAddress: dbRecord.formattedAddress,
        streetNumber: dbRecord.streetNumber,
        route: dbRecord.route,
        neighborhood: dbRecord.neighborhood,
        city: dbRecord.city,
        state: dbRecord.state,
        postalCode: dbRecord.postalCode,
        coordinates: {
          lat: Number(dbRecord.latitude),
          lng: Number(dbRecord.longitude)
        }
      },
      contact: {
        phoneNumber: dbRecord.phoneNumber,
        website: dbRecord.website,
        socialMedia: {
          facebook: dbRecord.facebookUrl,
          instagram: dbRecord.instagramUrl
        }
      },
      businessInfo: {
        rating: dbRecord.rating ? Number(dbRecord.rating) : undefined,
        reviewCount: dbRecord.reviewCount,
        priceLevel: dbRecord.priceLevel,
        categories: dbRecord.categories,
        isOpenNow: dbRecord.isOpenNow,
        businessHours: dbRecord.businessHours?.map((bh: any) => ({
          dayOfWeek: bh.dayOfWeek,
          openTime: bh.openTime,
          closeTime: bh.closeTime,
          isClosedAllDay: bh.isClosedAllDay
        }))
      },
      media: {
        photos: dbRecord.photos,
        profileImage: dbRecord.profileImage
      },
      metadata: {
        discoveredAt: dbRecord.discoveredAt || new Date(),
        lastUpdated: dbRecord.lastUpdated || new Date(),
        dataSource: 'google-places' as const,
        isActive: dbRecord.isActive
      }
    };
  }

  /**
   * Helper methods
   */
  private getPeriodStart(timeframe: '30d' | '90d' | '1y'): Date {
    const now = new Date();
    switch (timeframe) {
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  }

  private generateShareToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private prepareExportData(businesses: BrechoBusiness[], fields?: string[]) {
    console.log('📊 Preparing export data:', { 
      businessCount: businesses.length, 
      fieldsRequested: fields?.length || 'all' 
    });

    const defaultFields = [
      'name', 'address', 'rating', 'reviewCount', 'phoneNumber', 'website', 'distance'
    ];
    
    const selectedFields = fields && fields.length > 0 ? fields : defaultFields;
    
    return businesses.map((business, index) => {
      const exportRow: any = {};
      
      selectedFields.forEach(field => {
        switch (field) {
          case 'name':
            exportRow['Nome'] = business.name;
            break;
          case 'address':
            exportRow['Endereço'] = business.address.formattedAddress;
            break;
          case 'coordinates':
            exportRow['Latitude'] = business.address.coordinates.lat;
            exportRow['Longitude'] = business.address.coordinates.lng;
            break;
          case 'rating':
            exportRow['Avaliação'] = business.businessInfo.rating || 'N/A';
            break;
          case 'reviewCount':
            exportRow['Número de Avaliações'] = business.businessInfo.reviewCount || 0;
            break;
          case 'priceLevel':
            exportRow['Nível de Preço'] = business.businessInfo.priceLevel ? '$'.repeat(business.businessInfo.priceLevel) : 'N/A';
            break;
          case 'phoneNumber':
            exportRow['Telefone'] = business.contact.phoneNumber || 'N/A';
            break;
          case 'website':
            exportRow['Website'] = business.contact.website || 'N/A';
            break;
          case 'distance':
            exportRow['Distância (m)'] = (business as any).distanceFromCenter ? Math.round((business as any).distanceFromCenter) : 'N/A';
            break;
          case 'neighborhood':
            exportRow['Bairro'] = business.address.neighborhood || 'N/A';
            break;
          case 'city':
            exportRow['Cidade'] = business.address.city;
            break;
          case 'state':
            exportRow['Estado'] = business.address.state;
            break;
          case 'isOpenNow':
            exportRow['Status'] = business.businessInfo.isOpenNow !== undefined 
              ? (business.businessInfo.isOpenNow ? 'Aberto' : 'Fechado') 
              : 'N/A';
            break;
          case 'photos':
            exportRow['Fotos'] = business.media.photos.length > 0 ? business.media.photos.join('; ') : 'Nenhuma';
            break;
        }
      });
      
      // Add row number
      exportRow['#'] = index + 1;
      
      return exportRow;
    });
  }

  private async generateExportFile(data: any[], format: 'csv' | 'excel'): Promise<{ downloadUrl: string; fileSize: string }> {
    console.log('📁 Generating export file:', { format, recordCount: data.length });

    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `brechos-export-${timestamp}.${format}`;
      
      let fileContent: string;
      let mimeType: string;
      
      if (format === 'csv') {
        // Generate CSV
        if (data.length === 0) {
          fileContent = 'Nenhum dado encontrado\n';
        } else {
          const headers = Object.keys(data[0]);
          const csvRows = [
            headers.join(','), // Header row
            ...data.map(row => 
              headers.map(header => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma or quote
                const stringValue = String(value || '');
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
              }).join(',')
            )
          ];
          fileContent = csvRows.join('\n');
        }
        mimeType = 'text/csv';
      } else {
        // For Excel, we'll generate a simple tab-separated format that Excel can open
        // In a production environment, you'd use a library like xlsx
        if (data.length === 0) {
          fileContent = 'Nenhum dado encontrado\n';
        } else {
          const headers = Object.keys(data[0]);
          const tsvRows = [
            headers.join('\t'), // Header row
            ...data.map(row => 
              headers.map(header => String(row[header] || '')).join('\t')
            )
          ];
          fileContent = tsvRows.join('\n');
        }
        mimeType = 'application/vnd.ms-excel';
      }

      // Calculate file size
      const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      const fileSizeFormatted = fileSizeBytes < 1024 
        ? `${fileSizeBytes}B`
        : fileSizeBytes < 1024 * 1024
          ? `${(fileSizeBytes / 1024).toFixed(1)}KB`
          : `${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB`;

      // In a real implementation, you'd upload to cloud storage (S3, Google Cloud, etc.)
      // For now, we'll create a data URL that can be downloaded
      const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Content}`;

      console.log('✅ Export file generated:', { 
        filename, 
        size: fileSizeFormatted, 
        recordCount: data.length 
      });

      return {
        downloadUrl: dataUrl,
        fileSize: fileSizeFormatted
      };
    } catch (error) {
      console.error('❌ Error generating export file:', error);
      throw new Error('Failed to generate export file');
    }
  }
}