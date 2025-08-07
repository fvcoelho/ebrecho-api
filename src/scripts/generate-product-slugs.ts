import { prisma } from '../prisma';
import { generateProductSlug } from '../services/slug.service';

async function generateSlugsForExistingProducts() {
  console.log('Starting product slug generation...');
  
  try {
    // Get all products without slugs
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { slug: null },
          { slug: '' }
        ]
      },
      select: {
        id: true,
        name: true,
        sku: true
      }
    });
    
    console.log(`Found ${products.length} products without slugs`);
    
    // Update each product with a generated slug
    for (const product of products) {
      const slug = generateProductSlug(product.name, product.sku || undefined);
      
      await prisma.product.update({
        where: { id: product.id },
        data: { slug }
      });
      
      console.log(`Updated product ${product.id} with slug: ${slug}`);
    }
    
    console.log('Product slug generation completed!');
  } catch (error) {
    console.error('Error generating product slugs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateSlugsForExistingProducts();