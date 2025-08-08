/**
 * Script to generate basic Swagger documentation for routes
 * This creates a template that can be customized for each route
 */

export function generateSwaggerDoc(
  method: string,
  path: string,
  summary: string,
  tag: string,
  requiresAuth: boolean = true
) {
  const doc = `/**
 * @swagger
 * ${path}:
 *   ${method}:
 *     summary: ${summary}
 *     tags: [${tag}]${requiresAuth ? `
 *     security:
 *       - bearerAuth: []` : ''}
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */`;
  
  return doc;
}

// Example usage for common routes
interface RouteDoc {
  method: string;
  path: string;
  summary: string;
  tag: string;
  requiresAuth?: boolean;
}

const routeDocs: Record<string, RouteDoc[]> = {
  partners: [
    { method: 'get', path: '/api/partners', summary: 'Get all partners', tag: 'Partners' },
    { method: 'get', path: '/api/partners/{id}', summary: 'Get partner by ID', tag: 'Partners' },
    { method: 'post', path: '/api/partners', summary: 'Create partner', tag: 'Partners' },
    { method: 'put', path: '/api/partners/{id}', summary: 'Update partner', tag: 'Partners' },
    { method: 'delete', path: '/api/partners/{id}', summary: 'Delete partner', tag: 'Partners' },
  ],
  orders: [
    { method: 'get', path: '/api/orders', summary: 'Get all orders', tag: 'Orders' },
    { method: 'get', path: '/api/orders/{id}', summary: 'Get order by ID', tag: 'Orders' },
    { method: 'post', path: '/api/orders', summary: 'Create order', tag: 'Orders' },
    { method: 'put', path: '/api/orders/{id}/status', summary: 'Update order status', tag: 'Orders' },
  ],
  dashboard: [
    { method: 'get', path: '/api/dashboard/stats', summary: 'Get dashboard statistics', tag: 'Dashboard' },
    { method: 'get', path: '/api/dashboard/sales', summary: 'Get sales data', tag: 'Dashboard' },
    { method: 'get', path: '/api/dashboard/products', summary: 'Get product analytics', tag: 'Dashboard' },
  ],
  public: [
    { method: 'get', path: '/api/public/products', summary: 'Get public products', tag: 'Public', requiresAuth: false },
    { method: 'get', path: '/api/public/stores', summary: 'Get public stores', tag: 'Public', requiresAuth: false },
    { method: 'get', path: '/api/public/stores/{slug}', summary: 'Get store by slug', tag: 'Public', requiresAuth: false },
  ]
};

// Generate documentation
Object.entries(routeDocs).forEach(([category, routes]) => {
  console.log(`\n// ${category.toUpperCase()} ROUTES\n`);
  routes.forEach(route => {
    console.log(generateSwaggerDoc(
      route.method,
      route.path,
      route.summary,
      route.tag,
      route.requiresAuth ?? true
    ));
    console.log();
  });
});