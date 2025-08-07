-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTNER_ADMIN', 'PARTNER_USER', 'PROMOTER', 'PARTNER_PROMOTER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PromoterTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('DIRECT', 'BULK', 'PUBLIC', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('FLASH_SALE', 'SHOWCASE', 'SPOTLIGHT', 'SEASONAL', 'REGIONAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'PARTICIPATED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('INVITATION_BONUS', 'ONGOING_SALES', 'EVENT_BONUS', 'TIER_BONUS');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpires" TIMESTAMP(3),
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasPhysicalStore" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT,
    "publicDescription" TEXT,
    "isPublicActive" BOOLEAN NOT NULL DEFAULT true,
    "publicBanner" TEXT,
    "publicLogo" TEXT,
    "whatsappNumber" TEXT,
    "publicEmail" TEXT,
    "businessHours" JSONB,
    "socialLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    "color" TEXT,
    "condition" "ProductCondition" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'AVAILABLE',
    "slug" TEXT,
    "isPublicVisible" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publicTags" TEXT[],
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "processedUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "aiEnhanced" BOOLEAN NOT NULL DEFAULT false,
    "enhancementProvider" TEXT,
    "enhancementVersion" TEXT,
    "qualityScore" DECIMAL(3,2),
    "processingCost" DECIMAL(8,4),
    "enhancementRequestId" TEXT,
    "enhancedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEnhancementUsage" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enhancementType" TEXT NOT NULL,
    "imagesProcessed" INTEGER NOT NULL,
    "totalCost" DECIMAL(10,4) NOT NULL,
    "requestId" TEXT,
    "batchId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEnhancementUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.0200,
    "tier" "PromoterTier" NOT NULL DEFAULT 'BRONZE',
    "invitationQuota" INTEGER NOT NULL DEFAULT 10,
    "invitationsUsed" INTEGER NOT NULL DEFAULT 0,
    "totalCommissionsEarned" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalPartnersInvited" INTEGER NOT NULL DEFAULT 0,
    "successfulInvitations" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "territory" TEXT,
    "specialization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerInvitation" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "invitationCode" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "targetPhone" TEXT,
    "targetName" TEXT,
    "targetBusinessName" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "personalizedMessage" TEXT,
    "invitationType" "InvitationType" NOT NULL DEFAULT 'DIRECT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "resultingPartnerId" TEXT,
    "commissionAmount" DECIMAL(10,2),
    "commissionPercentage" DECIMAL(5,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerImage" TEXT,
    "eventType" "EventType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "targetCategories" TEXT[],
    "targetRegions" TEXT[],
    "discountPercentage" DECIMAL(5,2),
    "minDiscountPercentage" DECIMAL(5,2),
    "maxParticipants" INTEGER,
    "participationFee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "commissionBonus" DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    "participationRequirements" JSONB,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "landingPageUrl" TEXT,
    "socialHashtag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "invitedByPromoterId" TEXT NOT NULL,
    "invitationSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "participationStatus" "ParticipationStatus" NOT NULL DEFAULT 'INVITED',
    "productsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "salesDuringEvent" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "ordersDuringEvent" INTEGER NOT NULL DEFAULT 0,
    "commissionEarned" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "performanceRating" DECIMAL(3,2),
    "feedback" TEXT,
    "participationFeePaid" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "bonusEarned" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterCommission" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "referenceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,4) NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoterCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrechoBusiness" (
    "id" TEXT NOT NULL,
    "googlePlaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "streetNumber" TEXT,
    "route" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "phoneNumber" TEXT,
    "website" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER,
    "priceLevel" INTEGER,
    "categories" TEXT[],
    "isOpenNow" BOOLEAN,
    "photos" TEXT[],
    "profileImage" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'google-places',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BrechoBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrechoBusinessHours" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "isClosedAllDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BrechoBusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrechoSearchResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "searchCenter" JSONB NOT NULL,
    "searchRadius" INTEGER NOT NULL,
    "filtersApplied" JSONB,
    "distanceFromCenter" DECIMAL(8,2),
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrechoSearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrechoMapView" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "centerLat" DECIMAL(10,8) NOT NULL,
    "centerLng" DECIMAL(11,8) NOT NULL,
    "zoom" INTEGER NOT NULL,
    "mapType" TEXT NOT NULL DEFAULT 'roadmap',
    "filters" JSONB,
    "visibleLayers" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrechoMapView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrechoExportRequest" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "searchCriteria" JSONB NOT NULL,
    "fields" TEXT[],
    "deliveryMethod" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "recordCount" INTEGER,
    "fileSize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "expiresAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrechoExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_partnerId_idx" ON "User"("partnerId");

-- CreateIndex
CREATE INDEX "User_emailVerifyToken_idx" ON "User"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_document_key" ON "Partner"("document");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- CreateIndex
CREATE INDEX "Partner_email_idx" ON "Partner"("email");

-- CreateIndex
CREATE INDEX "Partner_document_idx" ON "Partner"("document");

-- CreateIndex
CREATE INDEX "Partner_slug_idx" ON "Partner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Address_partnerId_key" ON "Address"("partnerId");

-- CreateIndex
CREATE INDEX "Address_partnerId_idx" ON "Address"("partnerId");

-- CreateIndex
CREATE INDEX "Product_partnerId_idx" ON "Product"("partnerId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_isPublicVisible_idx" ON "Product"("isPublicVisible");

-- CreateIndex
CREATE INDEX "Product_viewCount_idx" ON "Product"("viewCount");

-- CreateIndex
CREATE UNIQUE INDEX "Product_partnerId_sku_key" ON "Product"("partnerId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_partnerId_slug_key" ON "Product"("partnerId", "slug");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_order_idx" ON "ProductImage"("order");

-- CreateIndex
CREATE INDEX "ProductImage_aiEnhanced_idx" ON "ProductImage"("aiEnhanced");

-- CreateIndex
CREATE INDEX "ProductImage_enhancementProvider_idx" ON "ProductImage"("enhancementProvider");

-- CreateIndex
CREATE INDEX "AIEnhancementUsage_partnerId_idx" ON "AIEnhancementUsage"("partnerId");

-- CreateIndex
CREATE INDEX "AIEnhancementUsage_provider_idx" ON "AIEnhancementUsage"("provider");

-- CreateIndex
CREATE INDEX "AIEnhancementUsage_enhancementType_idx" ON "AIEnhancementUsage"("enhancementType");

-- CreateIndex
CREATE INDEX "AIEnhancementUsage_createdAt_idx" ON "AIEnhancementUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AIEnhancementUsage_batchId_idx" ON "AIEnhancementUsage"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_userId_key" ON "Promoter"("userId");

-- CreateIndex
CREATE INDEX "Promoter_userId_idx" ON "Promoter"("userId");

-- CreateIndex
CREATE INDEX "Promoter_tier_idx" ON "Promoter"("tier");

-- CreateIndex
CREATE INDEX "Promoter_territory_idx" ON "Promoter"("territory");

-- CreateIndex
CREATE INDEX "Promoter_isActive_idx" ON "Promoter"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvitation_invitationCode_key" ON "PartnerInvitation"("invitationCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvitation_resultingPartnerId_key" ON "PartnerInvitation"("resultingPartnerId");

-- CreateIndex
CREATE INDEX "PartnerInvitation_promoterId_idx" ON "PartnerInvitation"("promoterId");

-- CreateIndex
CREATE INDEX "PartnerInvitation_invitationCode_idx" ON "PartnerInvitation"("invitationCode");

-- CreateIndex
CREATE INDEX "PartnerInvitation_status_idx" ON "PartnerInvitation"("status");

-- CreateIndex
CREATE INDEX "PartnerInvitation_targetEmail_idx" ON "PartnerInvitation"("targetEmail");

-- CreateIndex
CREATE INDEX "PartnerInvitation_expiresAt_idx" ON "PartnerInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "Event_promoterId_idx" ON "Event"("promoterId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "Event_startDate_endDate_idx" ON "Event"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Event_isPublic_idx" ON "Event"("isPublic");

-- CreateIndex
CREATE INDEX "Event_isFeatured_idx" ON "Event"("isFeatured");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_partnerId_idx" ON "EventParticipant"("partnerId");

-- CreateIndex
CREATE INDEX "EventParticipant_invitedByPromoterId_idx" ON "EventParticipant"("invitedByPromoterId");

-- CreateIndex
CREATE INDEX "EventParticipant_participationStatus_idx" ON "EventParticipant"("participationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_partnerId_key" ON "EventParticipant"("eventId", "partnerId");

-- CreateIndex
CREATE INDEX "PromoterCommission_promoterId_idx" ON "PromoterCommission"("promoterId");

-- CreateIndex
CREATE INDEX "PromoterCommission_partnerId_idx" ON "PromoterCommission"("partnerId");

-- CreateIndex
CREATE INDEX "PromoterCommission_commissionType_idx" ON "PromoterCommission"("commissionType");

-- CreateIndex
CREATE INDEX "PromoterCommission_status_idx" ON "PromoterCommission"("status");

-- CreateIndex
CREATE INDEX "PromoterCommission_periodStart_periodEnd_idx" ON "PromoterCommission"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BrechoBusiness_googlePlaceId_key" ON "BrechoBusiness"("googlePlaceId");

-- CreateIndex
CREATE INDEX "BrechoBusiness_googlePlaceId_idx" ON "BrechoBusiness"("googlePlaceId");

-- CreateIndex
CREATE INDEX "BrechoBusiness_city_state_idx" ON "BrechoBusiness"("city", "state");

-- CreateIndex
CREATE INDEX "BrechoBusiness_latitude_longitude_idx" ON "BrechoBusiness"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "BrechoBusiness_rating_idx" ON "BrechoBusiness"("rating");

-- CreateIndex
CREATE INDEX "BrechoBusiness_reviewCount_idx" ON "BrechoBusiness"("reviewCount");

-- CreateIndex
CREATE INDEX "BrechoBusiness_isActive_idx" ON "BrechoBusiness"("isActive");

-- CreateIndex
CREATE INDEX "BrechoBusiness_lastUpdated_idx" ON "BrechoBusiness"("lastUpdated");

-- CreateIndex
CREATE INDEX "BrechoBusinessHours_businessId_idx" ON "BrechoBusinessHours"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BrechoBusinessHours_businessId_dayOfWeek_key" ON "BrechoBusinessHours"("businessId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BrechoSearchResult_searchId_idx" ON "BrechoSearchResult"("searchId");

-- CreateIndex
CREATE INDEX "BrechoSearchResult_businessId_idx" ON "BrechoSearchResult"("businessId");

-- CreateIndex
CREATE INDEX "BrechoSearchResult_promoterId_idx" ON "BrechoSearchResult"("promoterId");

-- CreateIndex
CREATE INDEX "BrechoSearchResult_searchedAt_idx" ON "BrechoSearchResult"("searchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrechoMapView_shareToken_key" ON "BrechoMapView"("shareToken");

-- CreateIndex
CREATE INDEX "BrechoMapView_promoterId_idx" ON "BrechoMapView"("promoterId");

-- CreateIndex
CREATE INDEX "BrechoMapView_shareToken_idx" ON "BrechoMapView"("shareToken");

-- CreateIndex
CREATE INDEX "BrechoMapView_isPublic_idx" ON "BrechoMapView"("isPublic");

-- CreateIndex
CREATE INDEX "BrechoExportRequest_promoterId_idx" ON "BrechoExportRequest"("promoterId");

-- CreateIndex
CREATE INDEX "BrechoExportRequest_status_idx" ON "BrechoExportRequest"("status");

-- CreateIndex
CREATE INDEX "BrechoExportRequest_createdAt_idx" ON "BrechoExportRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEnhancementUsage" ADD CONSTRAINT "AIEnhancementUsage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvitation" ADD CONSTRAINT "PartnerInvitation_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvitation" ADD CONSTRAINT "PartnerInvitation_resultingPartnerId_fkey" FOREIGN KEY ("resultingPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_invitedByPromoterId_fkey" FOREIGN KEY ("invitedByPromoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterCommission" ADD CONSTRAINT "PromoterCommission_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterCommission" ADD CONSTRAINT "PromoterCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrechoBusinessHours" ADD CONSTRAINT "BrechoBusinessHours_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BrechoBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrechoSearchResult" ADD CONSTRAINT "BrechoSearchResult_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BrechoBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrechoSearchResult" ADD CONSTRAINT "BrechoSearchResult_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrechoMapView" ADD CONSTRAINT "BrechoMapView_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrechoExportRequest" ADD CONSTRAINT "BrechoExportRequest_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
