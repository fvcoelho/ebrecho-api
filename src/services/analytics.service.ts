import { BrechoBusiness, MarketAnalytics, Coordinate } from '../models/brecho-business.model';
import { LocationService } from './location.service';

export interface DensityPoint {
  coordinates: Coordinate;
  weight: number;
  businessCount: number;
  averageRating: number;
}

export interface MarketGap {
  area: {
    center: Coordinate;
    radius: number;
    name?: string;
  };
  populationDensity: 'high' | 'medium' | 'low';
  competitorCount: number;
  opportunityScore: number; // 0-100
  reasons: string[];
}

export interface CompetitorCluster {
  center: Coordinate;
  businesses: BrechoBusiness[];
  averageRating: number;
  totalReviews: number;
  competitionLevel: 'low' | 'medium' | 'high' | 'saturated';
  marketShare: number; // Estimated based on reviews and businessInfo.ratings
}

export interface TrendAnalysis {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    newBusinesses: number;
    businessGrowthRate: number;
    averageRatingTrend: number; // Positive/negative change
    reviewVelocityTrend: number; // Change in review frequency
  };
  insights: string[];
}

export class AnalyticsService {
  private locationService: LocationService;

  constructor(locationService: LocationService) {
    this.locationService = locationService;
  }

  /**
   * Generate comprehensive market analytics for a region
   */
  async generateMarketAnalytics(
    businesses: BrechoBusiness[],
    region?: { city?: string; state?: string; bounds?: { ne: Coordinate; sw: Coordinate } }
  ): Promise<MarketAnalytics> {
    console.log('📊 AnalyticsService.generateMarketAnalytics:', {
      businessCount: businesses.length,
      region
    });

    const overview = this.calculateOverviewMetrics(businesses);
    const geographic = await this.calculateGeographicMetrics(businesses);
    const competitive = this.calculateCompetitiveMetrics(businesses);

    const analytics: any = {
      overview,
      geographic,
      competitive
    };

    console.log('✅ Market analytics generated:', {
      totalBusinesses: overview.totalBusinesses,
      neighborhoodCount: geographic.densityByNeighborhood.length,
      underservedAreaCount: geographic.underservedAreas.length
    });

    return analytics;
  }

  /**
   * Generate density heat map data
   */
  generateDensityHeatMap(
    businesses: BrechoBusiness[],
    gridSize: number = 0.01 // Degrees (roughly 1km)
  ): DensityPoint[] {
    console.log('🗺️ AnalyticsService.generateDensityHeatMap:', {
      businessCount: businesses.length,
      gridSize
    });

    if (businesses.length === 0) return [];

    // Find bounds
    const latitudes = businesses.map(b => Number(b.address.coordinates.lat));
    const longitudes = businesses.map(b => Number(b.address.coordinates.lng));
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // Create grid
    const densityPoints: DensityPoint[] = [];
    
    for (let lat = minLat; lat <= maxLat; lat += gridSize) {
      for (let lng = minLng; lng <= maxLng; lng += gridSize) {
        const center: Coordinate = { lat, lng };
        const nearbyBusinesses = businesses.filter(business => 
          this.locationService.isWithinRadius(
            center,
            business.address.coordinates,
            1000 // 1km radius for each grid cell
          )
        );

        if (nearbyBusinesses.length > 0) {
          const averageRating = nearbyBusinesses.reduce((sum, b) => 
            sum + (Number(b.businessInfo.rating) || 0), 0
          ) / nearbyBusinesses.length;

          densityPoints.push({
            coordinates: center,
            weight: nearbyBusinesses.length,
            businessCount: nearbyBusinesses.length,
            averageRating
          });
        }
      }
    }

    console.log('✅ Density heat map generated:', { pointsCount: densityPoints.length });
    return densityPoints;
  }

  /**
   * Identify market gaps and opportunities
   */
  async identifyMarketGaps(
    businesses: BrechoBusiness[],
    targetArea: { center: Coordinate; radius: number },
    populationData?: Array<{ area: string; density: number; coordinates: Coordinate }>
  ): Promise<MarketGap[]> {
    console.log('🎯 AnalyticsService.identifyMarketGaps:', {
      businessCount: businesses.length,
      targetArea,
      hasPopulationData: !!populationData
    });

    const gaps: MarketGap[] = [];
    const searchRadius = 2000; // 2km radius for gap analysis
    const gridSize = 0.02; // Roughly 2km grid

    // Generate potential areas within target region
    const { northeast, southwest } = this.locationService.getBoundingBox(
      targetArea.center,
      targetArea.radius
    );

    for (let lat = southwest.lat; lat <= northeast.lat; lat += gridSize) {
      for (let lng = southwest.lng; lng <= northeast.lng; lng += gridSize) {
        const areaCenter: Coordinate = { lat, lng };
        
        // Count competitors in this area
        const nearbyCompetitors = businesses.filter(business =>
          this.locationService.isWithinRadius(areaCenter, business.address.coordinates, searchRadius)
        );

        // Determine population density (mock data if not provided)
        const populationDensity = this.estimatePopulationDensity(areaCenter, populationData);

        // Calculate opportunity score
        const opportunityScore = this.calculateOpportunityScore(
          nearbyCompetitors.length,
          populationDensity,
          areaCenter
        );

        // Identify as gap if score is high enough
        if (opportunityScore >= 60) {
          const reasons = this.generateGapReasons(nearbyCompetitors.length, populationDensity);
          
          gaps.push({
            area: {
              center: areaCenter,
              radius: searchRadius,
              name: await this.getAreaName(areaCenter)
            },
            populationDensity,
            competitorCount: nearbyCompetitors.length,
            opportunityScore,
            reasons
          });
        }
      }
    }

    // Sort by opportunity score
    gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);

    console.log('✅ Market gaps identified:', { gapCount: gaps.length });
    return gaps.slice(0, 10); // Return top 10 opportunities
  }

  /**
   * Analyze competitor clusters
   */
  analyzeCompetitorClusters(
    businesses: BrechoBusiness[],
    clusterRadius: number = 1500 // 1.5km
  ): CompetitorCluster[] {
    console.log('🏢 AnalyticsService.analyzeCompetitorClusters:', {
      businessCount: businesses.length,
      clusterRadius
    });

    const clusters: CompetitorCluster[] = [];
    const processed = new Set<string>();

    for (const business of businesses) {
      if (processed.has(business.id)) continue;

      // Find all businesses within cluster radius
      const clusterBusinesses = businesses.filter(other =>
        this.locationService.isWithinRadius(
          business.address.coordinates,
          other.address.coordinates,
          clusterRadius
        )
      );

      if (clusterBusinesses.length >= 2) {
        // Calculate cluster center
        const centerLat = clusterBusinesses.reduce((sum, b) => 
          sum + Number(b.address.coordinates.lat), 0
        ) / clusterBusinesses.length;
        
        const centerLng = clusterBusinesses.reduce((sum, b) => 
          sum + Number(b.address.coordinates.lng), 0
        ) / clusterBusinesses.length;

        // Calculate metrics
        const averageRating = clusterBusinesses.reduce((sum, b) => 
          sum + (Number(b.businessInfo.rating) || 0), 0
        ) / clusterBusinesses.length;

        const totalReviews = clusterBusinesses.reduce((sum, b) => 
          sum + (b.businessInfo.reviewCount || 0), 0
        );

        const competitionLevel = this.determineCompetitionLevel(clusterBusinesses.length);
        const marketShare = this.estimateMarketShare(clusterBusinesses);

        clusters.push({
          center: { lat: centerLat, lng: centerLng },
          businesses: clusterBusinesses,
          averageRating,
          totalReviews,
          competitionLevel,
          marketShare
        });

        // Mark businesses as processed
        clusterBusinesses.forEach(b => processed.add(b.id));
      }
    }

    console.log('✅ Competitor clusters analyzed:', { clusterCount: clusters.length });
    return clusters.sort((a, b) => b.businesses.length - a.businesses.length);
  }

  /**
   * Generate trend analysis
   */
  generateTrendAnalysis(
    currentBusinesses: BrechoBusiness[],
    historicalBusinesses?: BrechoBusiness[],
    timeframe: '30d' | '90d' | '1y' = '90d'
  ): TrendAnalysis {
    console.log('📈 AnalyticsService.generateTrendAnalysis:', {
      currentCount: currentBusinesses.length,
      historicalCount: historicalBusinesses?.length || 0,
      timeframe
    });

    const now = new Date();
    const periodStart = new Date();
    
    switch (timeframe) {
      case '30d':
        periodStart.setDate(now.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(now.getDate() - 90);
        break;
      case '1y':
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Calculate metrics
    const newBusinesses = currentBusinesses.filter(b => 
      new Date(b.metadata.discoveredAt) >= periodStart
    ).length;

    const businessGrowthRate = historicalBusinesses 
      ? ((currentBusinesses.length - historicalBusinesses.length) / historicalBusinesses.length) * 100
      : 0;

    const currentAvgRating = currentBusinesses.reduce((sum, b) => 
      sum + (Number(b.businessInfo.rating) || 0), 0
    ) / currentBusinesses.length;

    const historicalAvgRating = historicalBusinesses 
      ? historicalBusinesses.reduce((sum, b) => sum + (Number(b.businessInfo.rating) || 0), 0) / historicalBusinesses.length
      : currentAvgRating;

    const averageRatingTrend = currentAvgRating - historicalAvgRating;

    // Generate insights
    const insights = this.generateTrendInsights(
      newBusinesses,
      businessGrowthRate,
      averageRatingTrend,
      currentBusinesses.length
    );

    const analysis: TrendAnalysis = {
      period: { start: periodStart, end: now },
      metrics: {
        newBusinesses,
        businessGrowthRate,
        averageRatingTrend,
        reviewVelocityTrend: 0 // Would need historical review data
      },
      insights
    };

    console.log('✅ Trend analysis generated:', analysis.metrics);
    return analysis;
  }

  /**
   * Calculate overview metrics
   */
  private calculateOverviewMetrics(businesses: BrechoBusiness[]) {
    const totalBusinesses = businesses.length;
    const businessesWithRating = businesses.filter(b => b.businessInfo.rating);
    
    const averageRating = businessesWithRating.length > 0
      ? businessesWithRating.reduce((sum, b) => sum + Number(b.businessInfo.rating!), 0) / businessesWithRating.length
      : 0;

    const totalReviews = businesses.reduce((sum, b) => sum + (b.businessInfo.reviewCount || 0), 0);

    // Rating distribution
    const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    businessesWithRating.forEach(business => {
      const rating = Math.floor(Number(business.businessInfo.rating!));
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating.toString()]++;
      }
    });

    // Calculate density score and competition level
    const densityScore = totalBusinesses / 100; // businesses per 100 square km (rough calculation)
    const competitionLevel = densityScore > 10 ? 'HIGH' : densityScore > 5 ? 'MEDIUM' : 'LOW';

    return {
      totalBusinesses,
      averageRating: Math.round(averageRating * 10) / 10,
      densityScore: Math.round(densityScore * 10) / 10,
      competitionLevel: competitionLevel as 'LOW' | 'MEDIUM' | 'HIGH',
      totalReviews,
      ratingDistribution
    };
  }

  /**
   * Calculate geographic metrics
   */
  private async calculateGeographicMetrics(businesses: BrechoBusiness[]) {
    // Group by neighborhood/city
    const neighborhoodMap = new Map<string, BrechoBusiness[]>();
    
    businesses.forEach(business => {
      const key = business.address.neighborhood || business.address.city || 'Unknown';
      if (!neighborhoodMap.has(key)) {
        neighborhoodMap.set(key, []);
      }
      neighborhoodMap.get(key)!.push(business);
    });

    const densityByNeighborhood = Array.from(neighborhoodMap.entries()).map(([name, businesses]) => {
      const avgRating = businesses.reduce((sum, b) => 
        sum + (Number(b.businessInfo.rating) || 0), 0
      ) / businesses.length;

      return {
        name,
        count: businesses.length,
        avgRating: Math.round(avgRating * 10) / 10
      };
    }).sort((a, b) => b.count - a.count);

    // Mock underserved areas (in real implementation, would use demographic data)
    const underservedAreas = [
      { name: 'Zona Leste', populationDensity: 'high', brechoCount: Math.floor(Math.random() * 5) + 1 },
      { name: 'Zona Norte', populationDensity: 'medium', brechoCount: Math.floor(Math.random() * 8) + 2 },
      { name: 'Zona Sul', populationDensity: 'high', brechoCount: Math.floor(Math.random() * 15) + 5 }
    ].filter(area => area.brechoCount < 10); // Consider underserved if < 10 brechós

    return {
      densityByNeighborhood,
      underservedAreas
    };
  }

  /**
   * Calculate competitive metrics
   */
  private calculateCompetitiveMetrics(businesses: BrechoBusiness[]) {
    const sortedByRating = [...businesses]
      .filter(b => b.businessInfo.rating)
      .sort((a, b) => Number(b.businessInfo.rating!) - Number(a.businessInfo.rating!));

    const sortedByReviews = [...businesses]
      .filter(b => b.businessInfo.reviewCount)
      .sort((a, b) => (b.businessInfo.reviewCount!) - (a.businessInfo.reviewCount!));

    return {
      topRatedBusinesses: sortedByRating.slice(0, 10),
      marketLeaders: sortedByReviews.slice(0, 5),
      emergingCompetitors: businesses
        .filter(b => {
          const discoveredRecently = new Date(b.metadata.discoveredAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          const hasGoodRating = Number(b.businessInfo.rating || 0) >= 4.0;
          return discoveredRecently && hasGoodRating;
        })
        .slice(0, 10)
    };
  }

  /**
   * Estimate population density for an area
   */
  private estimatePopulationDensity(
    center: Coordinate,
    populationData?: Array<{ area: string; density: number; coordinates: Coordinate }>
  ): 'high' | 'medium' | 'low' {
    if (populationData) {
      const nearest = populationData.reduce((closest, area) => {
        const distance = this.locationService.calculateDistance(center, area.coordinates);
        return distance < closest.distance ? { area, distance } : closest;
      }, { area: populationData[0], distance: Infinity });

      if (nearest.area.density > 1000) return 'high';
      if (nearest.area.density > 500) return 'medium';
      return 'low';
    }

    // Mock estimation based on coordinates (would use real demographic data)
    const random = Math.random();
    return random > 0.6 ? 'high' : random > 0.3 ? 'medium' : 'low';
  }

  /**
   * Calculate opportunity score for a location
   */
  private calculateOpportunityScore(
    competitorCount: number,
    populationDensity: 'high' | 'medium' | 'low',
    location: Coordinate
  ): number {
    let score = 0;

    // Population density factor (40% weight)
    if (populationDensity === 'high') score += 40;
    else if (populationDensity === 'medium') score += 25;
    else score += 10;

    // Competition factor (40% weight)
    if (competitorCount === 0) score += 40;
    else if (competitorCount <= 2) score += 30;
    else if (competitorCount <= 5) score += 15;
    else score += 0;

    // Location accessibility factor (20% weight) - simplified
    score += Math.random() * 20; // Would use real accessibility data

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate reasons for market gap identification
   */
  private generateGapReasons(
    competitorCount: number,
    populationDensity: 'high' | 'medium' | 'low'
  ): string[] {
    const reasons = [];

    if (competitorCount === 0) {
      reasons.push('Nenhum concorrente direto na área');
    } else if (competitorCount <= 2) {
      reasons.push('Baixa concorrência na região');
    }

    if (populationDensity === 'high') {
      reasons.push('Alta densidade populacional');
    } else if (populationDensity === 'medium') {
      reasons.push('Densidade populacional moderada');
    }

    reasons.push('Área com potencial de crescimento');

    return reasons;
  }

  /**
   * Get area name from coordinates
   */
  private async getAreaName(coordinates: Coordinate): Promise<string> {
    try {
      const result = await this.locationService.reverseGeocode(coordinates);
      return result?.components.neighborhood || result?.components.city || 'Área não identificada';
    } catch {
      return 'Área não identificada';
    }
  }

  /**
   * Determine competition level based on business count
   */
  private determineCompetitionLevel(businessCount: number): 'low' | 'medium' | 'high' | 'saturated' {
    if (businessCount <= 2) return 'low';
    if (businessCount <= 5) return 'medium';
    if (businessCount <= 10) return 'high';
    return 'saturated';
  }

  /**
   * Estimate market share for businesses in a cluster
   */
  private estimateMarketShare(businesses: BrechoBusiness[]): number {
    const totalReviews = businesses.reduce((sum, b) => sum + (b.businessInfo.reviewCount || 0), 0);
    
    if (totalReviews === 0) return 0;
    
    // Simplified market share based on review count and businessInfo.ratings
    return businesses.reduce((share, business) => {
      const reviews = business.businessInfo.reviewCount || 0;
      const rating = Number(business.businessInfo.rating) || 0;
      return share + (reviews * rating) / (totalReviews * 5) * 100;
    }, 0);
  }

  /**
   * Generate trend insights
   */
  private generateTrendInsights(
    newBusinesses: number,
    growthRate: number,
    ratingTrend: number,
    totalBusinesses: number
  ): string[] {
    const insights = [];

    if (newBusinesses > totalBusinesses * 0.1) {
      insights.push('Mercado em forte expansão com muitos novos negócios');
    } else if (newBusinesses > 0) {
      insights.push('Crescimento moderado do mercado');
    }

    if (growthRate > 20) {
      insights.push('Taxa de crescimento elevada indica mercado aquecido');
    } else if (growthRate < -10) {
      insights.push('Possível retração do mercado');
    }

    if (ratingTrend > 0.2) {
      insights.push('Melhoria na qualidade geral dos serviços');
    } else if (ratingTrend < -0.2) {
      insights.push('Declínio na satisfação dos clientes');
    }

    if (insights.length === 0) {
      insights.push('Mercado estável sem mudanças significativas');
    }

    return insights;
  }
}