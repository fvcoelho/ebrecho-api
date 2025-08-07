import { prisma } from '../prisma';

// Reserved slugs that cannot be used by partners
const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'dashboard',
  'login',
  'logout',
  'register',
  'cadastro',
  'setup',
  'settings',
  'configuracoes',
  'produtos',
  'products',
  'cart',
  'carrinho',
  'checkout',
  'about',
  'sobre',
  'contact',
  'contato',
  'help',
  'ajuda',
  'terms',
  'termos',
  'privacy',
  'privacidade',
  'public',
  'static',
  'assets',
  'images',
  'css',
  'js',
  'fonts',
  '_next',
  'vercel',
  'ebrecho',
  'blog',
  'news',
  'support',
  'suporte'
];

// Normalize slug (lowercase, replace spaces and special chars with hyphens)
export function normalizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single
}

// Validate slug format
export function isValidSlugFormat(slug: string): boolean {
  // Must be 3-50 chars, lowercase letters, numbers and hyphens only
  // Cannot start or end with hyphen
  const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
  return slugRegex.test(slug);
}

// Check if slug is reserved
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

// Check if slug is available for a partner
export async function isSlugAvailable(slug: string, excludePartnerId?: string): Promise<boolean> {
  const normalizedSlug = slug.toLowerCase();
  
  // Check if reserved
  if (isReservedSlug(normalizedSlug)) {
    return false;
  }
  
  // Check if already taken by another partner
  const existingPartner = await prisma.partner.findFirst({
    where: {
      slug: normalizedSlug,
      ...(excludePartnerId && { id: { not: excludePartnerId } })
    }
  });
  
  return !existingPartner;
}

// Generate a unique slug from a name
export async function generateUniqueSlug(name: string, excludePartnerId?: string): Promise<string> {
  let baseSlug = normalizeSlug(name);
  
  // Ensure minimum length
  if (baseSlug.length < 3) {
    baseSlug = baseSlug.padEnd(3, '0');
  }
  
  // Truncate if too long
  if (baseSlug.length > 45) {
    baseSlug = baseSlug.substring(0, 45);
  }
  
  // Check if base slug is available
  let slug = baseSlug;
  let counter = 1;
  
  while (!(await isSlugAvailable(slug, excludePartnerId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    // Safety check to prevent infinite loop
    if (counter > 100) {
      throw new Error('Unable to generate unique slug');
    }
  }
  
  return slug;
}

// Validate slug for use
export async function validateSlug(slug: string, excludePartnerId?: string): Promise<{ valid: boolean; error?: string }> {
  // Check format
  if (!isValidSlugFormat(slug)) {
    return {
      valid: false,
      error: 'Slug must be 3-50 characters, lowercase letters, numbers and hyphens only'
    };
  }
  
  // Check if reserved
  if (isReservedSlug(slug)) {
    return {
      valid: false,
      error: 'This slug is reserved and cannot be used'
    };
  }
  
  // Check availability
  const available = await isSlugAvailable(slug, excludePartnerId);
  if (!available) {
    return {
      valid: false,
      error: 'This slug is already taken'
    };
  }
  
  return { valid: true };
}

// Generate slug for a product
export function generateProductSlug(productName: string, sku?: string): string {
  const baseSlug = normalizeSlug(productName);
  
  // If we have SKU, append part of it for uniqueness
  if (sku) {
    const skuPart = sku.slice(-4).toLowerCase();
    return `${baseSlug}-${skuPart}`;
  }
  
  // Otherwise, we'll need to add timestamp or random suffix
  const timestamp = Date.now().toString(36).slice(-4);
  return `${baseSlug}-${timestamp}`;
}