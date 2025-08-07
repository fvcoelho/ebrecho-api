import { Request, Response } from 'express';
import { z } from 'zod';
import { BrechoDiscoveryService } from '../../services/brecho-discovery.service';
import { GooglePlacesService } from '../../services/google-places.service';
import { LocationService } from '../../services/location.service';
import { AnalyticsService } from '../../services/analytics.service';
import { PrismaClient } from '@prisma/client';

// Validation schemas
const searchSchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radius: z.number().min(100).max(50000) // 100m to 50km
  }),
  filters: z.object({
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    minReviewCount: z.number().min(0).optional(),
    priceLevel: z.array(z.number().min(1).max(4)).optional(),
    openNow: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    hasPhotos: z.boolean().optional(),
    openWeekends: z.boolean().optional(),
    categories: z.array(z.string()).optional()
  }).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(50)
  }).optional()
});

const mapDataSchema = z.object({
  bounds: z.object({
    ne: z.object({
      lat: z.number(),
      lng: z.number()
    }),
    sw: z.object({
      lat: z.number(),
      lng: z.number()
    })
  }),
  zoom: z.number().min(1).max(20),
  filters: z.object({
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    minReviewCount: z.number().min(0).optional(),
    priceLevel: z.array(z.number().min(1).max(4)).optional(),
    openNow: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    hasPhotos: z.boolean().optional()
  }).optional()
});

const saveMapViewSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  center: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  zoom: z.number().min(1).max(20),
  mapType: z.enum(['roadmap', 'satellite', 'hybrid', 'terrain']),
  filters: z.record(z.any()).optional(),
  visibleLayers: z.array(z.string()),
  isPublic: z.boolean().default(false)
});

const exportSchema = z.object({
  format: z.enum(['csv', 'excel']),
  searchCriteria: searchSchema,
  fields: z.array(z.string()).optional(),
  deliveryMethod: z.enum(['download', 'email']).default('download')
});

export class BrechoDiscoveryController {
  private discoveryService: BrechoDiscoveryService;
  private prisma: PrismaClient;

  constructor() {
    // Initialize services (in a real app, these would be injected via DI)
    this.prisma = new PrismaClient();
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY!;
    
    const googlePlaces = new GooglePlacesService({
      apiKey: googleApiKey,
      language: 'pt-BR',
      region: 'br'
    });
    
    const locationService = new LocationService(googleApiKey);
    const analyticsService = new AnalyticsService(locationService);
    
    this.discoveryService = new BrechoDiscoveryService(
      this.prisma,
      googlePlaces,
      locationService,
      analyticsService
    );
  }

  /**
   * Search for brechós
   * POST /api/promoter/market-intelligence/brechos/search
   */
  async search(req: Request, res: Response) {
    try {
      console.log('🔍 BrechoDiscoveryController.search:', {
        userId: req.user?.id,
        userRole: req.user?.role,
        body: req.body
      });

      // Validate request body
      const validatedData = searchSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get the promoter ID from the database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          promoter: true
        }
      });

      if (!user || !user.promoter) {
        return res.status(403).json({
          success: false,
          error: 'Promoter profile not found'
        });
      }

      if (!user.promoter.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Promoter account is inactive'
        });
      }

      const promoterId = user.promoter.id;

      console.log('🎯 Using promoter ID:', {
        userId: userId,
        promoterId: promoterId,
        businessName: user.promoter.businessName
      });

      // Validate required location
      if (!validatedData.location) {
        return res.status(400).json({
          success: false,
          error: 'Location is required for search'
        });
      }

      // Perform search
      const results = await this.discoveryService.searchBrechos(validatedData as any, promoterId);

      console.log('✅ Search completed:', {
        totalFound: results.pagination.total,
        returned: results.businesses.length
      });

      return res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('❌ Search error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get market analytics
   * GET /api/promoter/market-intelligence/brechos/analytics
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      console.log('📊 BrechoDiscoveryController.getAnalytics:', {
        query: req.query
      });

      const region = {
        city: req.query.city as string,
        state: req.query.state as string,
        coordinates: req.query.lat && req.query.lng ? {
          lat: parseFloat(req.query.lat as string),
          lng: parseFloat(req.query.lng as string),
          radius: parseInt(req.query.radius as string) || 10000
        } : undefined
      };

      const timeframe = (req.query.timeframe as '30d' | '90d' | '1y') || '90d';

      const analytics = await this.discoveryService.getMarketAnalytics(region, timeframe);

      console.log('✅ Analytics generated');

      return res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('❌ Analytics error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get map data for visualization
   * GET /api/promoter/market-intelligence/brechos/map-data
   */
  async getMapData(req: Request, res: Response) {
    try {
      console.log('🗺️ BrechoDiscoveryController.getMapData:', {
        query: req.query
      });

      // Parse bounds from query string
      const boundsParam = req.query.bounds as string;
      if (!boundsParam) {
        return res.status(400).json({
          success: false,
          error: 'Bounds parameter is required'
        });
      }

      const [swLat, swLng, neLat, neLng] = boundsParam.split(',').map(Number);
      const zoom = parseInt(req.query.zoom as string) || 10;
      
      const filters = req.query.filters ? JSON.parse(req.query.filters as string) : undefined;

      const bounds = {
        sw: { lat: swLat, lng: swLng },
        ne: { lat: neLat, lng: neLng }
      };

      const mapData = await this.discoveryService.getMapData(bounds, zoom, filters);

      console.log('✅ Map data retrieved:', {
        markersCount: mapData.markers.length,
        clustersCount: mapData.clusters.length
      });

      return res.json({
        success: true,
        data: mapData
      });
    } catch (error) {
      console.error('❌ Map data error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Save map view
   * POST /api/promoter/market-intelligence/map-views
   */
  async saveMapView(req: Request, res: Response) {
    try {
      console.log('💾 BrechoDiscoveryController.saveMapView:', {
        promoterId: req.user?.id,
        body: req.body
      });

      const validatedData = saveMapViewSchema.parse(req.body);
      const promoterId = req.user?.id;

      if (!promoterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const mapView = await this.discoveryService.saveMapView(promoterId, validatedData as any);

      console.log('✅ Map view saved:', { id: mapView.id });

      return res.json({
        success: true,
        data: mapView
      });
    } catch (error) {
      console.error('❌ Save map view error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Export search results
   * POST /api/promoter/market-intelligence/brechos/export
   */
  async exportResults(req: Request, res: Response) {
    try {
      console.log('📊 BrechoDiscoveryController.exportResults:', {
        promoterId: req.user?.id,
        body: req.body
      });

      const validatedData = exportSchema.parse(req.body);
      const promoterId = req.user?.id;

      if (!promoterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const exportResult = await this.discoveryService.exportResults(
        promoterId,
        validatedData.searchCriteria as any,
        validatedData.format,
        validatedData.fields
      );

      console.log('✅ Export completed:', exportResult);

      return res.json({
        success: true,
        data: exportResult
      });
    } catch (error) {
      console.error('❌ Export error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Route planning and optimization
   * POST /api/promoter/market-intelligence/brechos/route
   */
  async planRoute(req: Request, res: Response) {
    try {
      console.log('🗺️ BrechoDiscoveryController.planRoute:', {
        body: req.body
      });

      const { businessIds, startLocation, optimize, travelMode } = req.body;

      if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Business IDs are required'
        });
      }

      if (!startLocation || typeof startLocation.lat !== 'number' || typeof startLocation.lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Valid start location is required'
        });
      }

      // Mock route planning response (implementation would use actual routing service)
      const mockRoute = {
        stops: businessIds,
        totalDistance: '25.4 km',
        estimatedTime: '1h 15min',
        routeOptimized: optimize || false,
        waypoints: [
          { lat: startLocation.lat, lng: startLocation.lng },
          // Add waypoints for each business
          ...businessIds.map((_, index) => ({
            lat: startLocation.lat + (Math.random() - 0.5) * 0.01,
            lng: startLocation.lng + (Math.random() - 0.5) * 0.01
          }))
        ],
        instructions: [
          {
            instruction: 'Head north on Main St',
            distance: '1.2 km',
            duration: '3 min',
            startLocation: startLocation,
            endLocation: { lat: startLocation.lat + 0.01, lng: startLocation.lng }
          }
        ]
      };

      console.log('✅ Route planned:', {
        stopsCount: businessIds.length,
        totalDistance: mockRoute.totalDistance
      });

      return res.json({
        success: true,
        data: {
          route: mockRoute,
          alternatives: [],
          analytics: {
            efficiency: 85,
            fuelCost: 'R$ 45.00',
            carbonFootprint: '12.5 kg CO2'
          }
        }
      });
    } catch (error) {
      console.error('❌ Route planning error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Area analysis for market gaps
   * POST /api/promoter/market-intelligence/brechos/area-analysis
   */
  async analyzeArea(req: Request, res: Response) {
    try {
      console.log('🎯 BrechoDiscoveryController.analyzeArea:', {
        body: req.body
      });

      const { area, includeCompetitors, includeDemographics } = req.body;

      if (!area) {
        return res.status(400).json({
          success: false,
          error: 'Area parameter is required'
        });
      }

      // Mock area analysis (implementation would use real data)
      const analysis = {
        areaInfo: {
          name: 'Vila Madalena',
          type: 'Neighborhood',
          coordinates: area.center || { lat: -23.5505, lng: -46.6833 },
          radius: area.radius || 2000
        },
        marketMetrics: {
          competitorCount: Math.floor(Math.random() * 20) + 1,
          averageRating: (Math.random() * 2 + 3).toFixed(1),
          marketDensity: 'medium',
          opportunityScore: Math.floor(Math.random() * 100)
        },
        demographics: includeDemographics ? {
          population: 45000,
          averageIncome: 'R$ 5.500',
          ageGroups: {
            '18-35': 35,
            '36-50': 30,
            '51+': 35
          },
          shoppingBehavior: 'High fashion consciousness'
        } : null,
        competitors: includeCompetitors ? [
          {
            id: 'comp1',
            name: 'Brechó da Vila',
            distance: '0.5 km',
            rating: 4.2,
            priceLevel: 2
          }
        ] : null,
        recommendations: [
          'Área com boa oportunidade de mercado',
          'Demografia favorável para brechós',
          'Concorrência moderada'
        ]
      };

      console.log('✅ Area analysis completed');

      return res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('❌ Area analysis error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get saved map views
   * GET /api/promoter/market-intelligence/map-views
   */
  async getMapViews(req: Request, res: Response) {
    try {
      console.log('📖 BrechoDiscoveryController.getMapViews:', {
        promoterId: req.user?.id
      });

      const promoterId = req.user?.id;

      if (!promoterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get saved map views for the promoter
      const prisma = new PrismaClient();
      const mapViews = await prisma.brechoMapView.findMany({
        where: {
          OR: [
            { promoterId },
            { isPublic: true }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          centerLat: true,
          centerLng: true,
          zoom: true,
          mapType: true,
          isPublic: true,
          shareToken: true,
          createdAt: true,
          promoter: {
            select: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const formattedViews = mapViews.map(view => ({
        id: view.id,
        name: view.name,
        description: view.description,
        center: { lat: Number(view.centerLat), lng: Number(view.centerLng) },
        zoom: view.zoom,
        mapType: view.mapType,
        isPublic: view.isPublic,
        shareToken: view.shareToken,
        createdAt: view.createdAt,
        createdBy: view.promoter.user.name
      }));

      console.log('✅ Map views retrieved:', { count: formattedViews.length });

      return res.json({
        success: true,
        data: formattedViews
      });
    } catch (error) {
      console.error('❌ Get map views error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new BrechoDiscoveryController();