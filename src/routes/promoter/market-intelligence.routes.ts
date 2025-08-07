import { Router } from 'express';
import brechoDiscoveryController from '../../controllers/promoter/brecho-discovery.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { promoterMiddleware } from '../../middlewares/promoter.middleware';

const router = Router();

// Apply authentication and role check middleware
router.use(authMiddleware);
router.use(promoterMiddleware);

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/search:
 *   post:
 *     tags: [Market Intelligence]
 *     summary: Search for brechós in a specific area
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - location
 *             properties:
 *               location:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   lng:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                   radius:
 *                     type: number
 *                     minimum: 100
 *                     maximum: 50000
 *                     description: Search radius in meters
 *               filters:
 *                 type: object
 *                 properties:
 *                   minRating:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 5
 *                   maxRating:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 5
 *                   minReviewCount:
 *                     type: number
 *                     minimum: 0
 *                   priceLevel:
 *                     type: array
 *                     items:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 4
 *                   openNow:
 *                     type: boolean
 *                   hasWebsite:
 *                     type: boolean
 *                   hasPhotos:
 *                     type: boolean
 *               pagination:
 *                 type: object
 *                 properties:
 *                   page:
 *                     type: number
 *                     minimum: 1
 *                     default: 1
 *                   limit:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 100
 *                     default: 50
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     businesses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BrechoBusiness'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     searchMetadata:
 *                       type: object
 */
router.post('/brechos/search', brechoDiscoveryController.search.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/analytics:
 *   get:
 *     tags: [Market Intelligence]
 *     summary: Get market analytics for a region
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: City name for analysis
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State name for analysis
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude for coordinate-based analysis
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude for coordinate-based analysis
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10000
 *         description: Radius in meters for coordinate-based analysis
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 1y]
 *           default: 90d
 *         description: Timeframe for trend analysis
 *     responses:
 *       200:
 *         description: Market analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MarketAnalytics'
 */
router.get('/brechos/analytics', brechoDiscoveryController.getAnalytics.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/map-data:
 *   get:
 *     tags: [Market Intelligence]
 *     summary: Get optimized data for map visualization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bounds
 *         required: true
 *         schema:
 *           type: string
 *         description: Map bounds in format "swLat,swLng,neLat,neLng"
 *       - in: query
 *         name: zoom
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *         description: Current map zoom level
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: JSON-encoded filter criteria
 *     responses:
 *       200:
 *         description: Map data with markers and clusters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     markers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MapMarker'
 *                     clusters:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MarkerCluster'
 *                     analytics:
 *                       type: object
 */
router.get('/brechos/map-data', brechoDiscoveryController.getMapData.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/route:
 *   post:
 *     tags: [Market Intelligence]
 *     summary: Plan optimized route for visiting multiple brechós
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessIds
 *               - startLocation
 *             properties:
 *               businessIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of business IDs to visit
 *               startLocation:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               optimize:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to optimize route order
 *               travelMode:
 *                 type: string
 *                 enum: [driving, walking, transit]
 *                 default: driving
 *     responses:
 *       200:
 *         description: Optimized route information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RouteInfo'
 */
router.post('/brechos/route', brechoDiscoveryController.planRoute.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/area-analysis:
 *   post:
 *     tags: [Market Intelligence]
 *     summary: Analyze market opportunities in a specific area
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - area
 *             properties:
 *               area:
 *                 type: object
 *                 properties:
 *                   center:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                   radius:
 *                     type: number
 *                     description: Analysis radius in meters
 *               includeCompetitors:
 *                 type: boolean
 *                 default: true
 *               includeDemographics:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Area analysis results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.post('/brechos/area-analysis', brechoDiscoveryController.analyzeArea.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/brechos/export:
 *   post:
 *     tags: [Market Intelligence]
 *     summary: Export search results to CSV or Excel
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - format
 *               - searchCriteria
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [csv, excel]
 *               searchCriteria:
 *                 type: object
 *                 description: Same structure as search endpoint
 *               fields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific fields to include in export
 *               deliveryMethod:
 *                 type: string
 *                 enum: [download, email]
 *                 default: download
 *     responses:
 *       200:
 *         description: Export request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     downloadUrl:
 *                       type: string
 *                     recordCount:
 *                       type: number
 *                     fileSize:
 *                       type: string
 */
router.post('/brechos/export', brechoDiscoveryController.exportResults.bind(brechoDiscoveryController));

/**
 * @swagger
 * /api/promoter/market-intelligence/map-views:
 *   get:
 *     tags: [Market Intelligence]
 *     summary: Get saved map views
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved map views
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MapView'
 *   post:
 *     tags: [Market Intelligence]
 *     summary: Save a map view for sharing and collaboration
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - center
 *               - zoom
 *               - mapType
 *               - visibleLayers
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               center:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *               zoom:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 20
 *               mapType:
 *                 type: string
 *                 enum: [roadmap, satellite, hybrid, terrain]
 *               filters:
 *                 type: object
 *               visibleLayers:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Map view saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MapView'
 */
router.get('/map-views', brechoDiscoveryController.getMapViews.bind(brechoDiscoveryController));
router.post('/map-views', brechoDiscoveryController.saveMapView.bind(brechoDiscoveryController));

export default router;