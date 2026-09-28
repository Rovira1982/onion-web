-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('cliente', 'admin', 'operario');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pendiente_pago', 'pagado', 'en_diseno', 'en_aprobacion', 'en_produccion', 'terminado', 'entregado');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('vencido', 'critico', 'alta', 'media', 'baja');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('tarjeta', 'bizum', 'transferencia');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pendiente', 'pagado', 'fallido');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occasions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "material" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "supplierModelCode" TEXT NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_occasions" (
    "productId" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,

    CONSTRAINT "product_occasions_pkey" PRIMARY KEY ("productId","occasionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'cliente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'pendiente_pago',
    "priority" "OrderPriority" NOT NULL DEFAULT 'media',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pendiente',
    "deliveryTargetDate" TIMESTAMP(3),
    "total" DECIMAL(10,2) NOT NULL,
    "invoiceName" TEXT NOT NULL,
    "invoiceTaxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "individualName" TEXT,
    "individualNumber" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_configs" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "logoFileUrl" TEXT NOT NULL,
    "markings" JSONB NOT NULL,
    "previewImageUrl" TEXT NOT NULL,

    CONSTRAINT "design_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "occasions_name_key" ON "occasions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "occasions_slug_key" ON "occasions"("slug");

-- CreateIndex
CREATE INDEX "products_categoryId_supplierId_idx" ON "products"("categoryId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "products_supplierId_supplierSku_key" ON "products"("supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "orders_status_priority_idx" ON "orders"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "design_configs_orderLineId_key" ON "design_configs"("orderLineId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_occasions" ADD CONSTRAINT "product_occasions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_occasions" ADD CONSTRAINT "product_occasions_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "occasions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_configs" ADD CONSTRAINT "design_configs_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
