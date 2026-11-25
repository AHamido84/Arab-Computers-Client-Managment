-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNT_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'SMTP');

-- CreateEnum
CREATE TYPE "DigitStyle" AS ENUM ('LATIN', 'ARABIC_INDIC');

-- CreateEnum
CREATE TYPE "LookupKind" AS ENUM ('CLIENT_STATUS', 'INDUSTRY', 'PRODUCT', 'REQUEST_TYPE', 'PAYMENT_TERM');

-- CreateEnum
CREATE TYPE "AttachmentEntity" AS ENUM ('CLIENT', 'CONTRACT', 'REQUEST', 'QUOTATION', 'EMAIL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmcMethod" AS ENUM ('COMPOUND', 'SIMPLE');

-- CreateEnum
CREATE TYPE "AmcLineStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'UNDER_STUDY', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'DELIVERED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CONTRACT', 'AMC_RENEWAL', 'QUOTATION');

-- CreateEnum
CREATE TYPE "EmailTemplateKind" AS ENUM ('AMC_REMINDER', 'AMC_OVERDUE', 'QUOTATION', 'CONTRACT', 'REQUEST_UPDATE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('AMC_UPCOMING', 'AMC_OVERDUE', 'REQUEST_DUE', 'REQUEST_OVERDUE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "locale" "Locale" NOT NULL DEFAULT 'ar',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyNameAr" TEXT NOT NULL,
    "companyNameEn" TEXT NOT NULL,
    "addressAr" TEXT,
    "addressEn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "taxNumber" TEXT,
    "commercialRegister" TEXT,
    "logoUrl" TEXT,
    "letterheadFooterAr" TEXT,
    "letterheadFooterEn" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EGP',
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "defaultAmcPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "defaultAmcYears" INTEGER NOT NULL DEFAULT 5,
    "quotationValidityDays" INTEGER NOT NULL DEFAULT 30,
    "arabicDigits" "DigitStyle" NOT NULL DEFAULT 'LATIN',
    "notifyIntervals" INTEGER[] DEFAULT ARRAY[30, 14, 3]::INTEGER[],
    "notifyOverdueEveryDays" INTEGER NOT NULL DEFAULT 7,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "emailProvider" "EmailProvider" NOT NULL DEFAULT 'RESEND',
    "emailFrom" TEXT,
    "emailReplyTo" TEXT,
    "contractNumberFormat" TEXT NOT NULL DEFAULT 'CT-{YYYY}-{0000}',
    "requestNumberFormat" TEXT NOT NULL DEFAULT 'RQ-{YYYY}-{0000}',
    "quotationNumberFormat" TEXT NOT NULL DEFAULT 'Q-{YYYY}-{0000}',
    "clientCodeFormat" TEXT NOT NULL DEFAULT 'CL-{0000}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "LookupValue" (
    "id" TEXT NOT NULL,
    "kind" "LookupKind" NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "industryId" TEXT,
    "preferredLang" "Locale" NOT NULL DEFAULT 'ar',
    "address" TEXT,
    "city" TEXT,
    "website" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "accountManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPerson" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" "AttachmentEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT,
    "contractDate" DATE NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "value" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "paymentTerms" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "amcEnabled" BOOLEAN NOT NULL DEFAULT true,
    "amcPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "amcIncreasePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amcMethod" "AmcMethod" NOT NULL DEFAULT 'COMPOUND',
    "amcStartDate" DATE,
    "amcYears" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractProduct" (
    "contractId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ContractProduct_pkey" PRIMARY KEY ("contractId","productId")
);

-- CreateTable
CREATE TABLE "AmcScheduleLine" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "yearIndex" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "increasePercentOverride" DECIMAL(5,2),
    "amountOverride" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "AmcLineStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" DATE,
    "paidAmount" DECIMAL(14,2),
    "invoiceRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmcScheduleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "typeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "requestDate" DATE NOT NULL,
    "dueDate" DATE,
    "estimatedHours" DECIMAL(8,2),
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "title" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "lang" "Locale" NOT NULL DEFAULT 'ar',
    "issueDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "introText" TEXT,
    "terms" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "requestId" TEXT,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "startDate" DATE,
    "dueDate" DATE,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "lang" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL,
    "lang" "Locale" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "to" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentName" TEXT,
    "attachmentUrl" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "clientId" TEXT,
    "dueDate" DATE NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LookupValue_kind_sortOrder_idx" ON "LookupValue"("kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_kind_key_key" ON "LookupValue"("kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_statusId_idx" ON "Client"("statusId");

-- CreateIndex
CREATE INDEX "Client_accountManagerId_idx" ON "Client"("accountManagerId");

-- CreateIndex
CREATE INDEX "ContactPerson_clientId_idx" ON "ContactPerson"("clientId");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "AmcScheduleLine_dueDate_status_idx" ON "AmcScheduleLine"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AmcScheduleLine_contractId_yearIndex_key" ON "AmcScheduleLine"("contractId", "yearIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRequest_number_key" ON "ClientRequest"("number");

-- CreateIndex
CREATE INDEX "ClientRequest_clientId_idx" ON "ClientRequest"("clientId");

-- CreateIndex
CREATE INDEX "ClientRequest_status_idx" ON "ClientRequest"("status");

-- CreateIndex
CREATE INDEX "ClientRequest_dueDate_idx" ON "ClientRequest"("dueDate");

-- CreateIndex
CREATE INDEX "RequestItem_requestId_idx" ON "RequestItem"("requestId");

-- CreateIndex
CREATE INDEX "Quotation_clientId_idx" ON "Quotation"("clientId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_number_version_key" ON "Quotation"("number", "version");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_kind_lang_key" ON "DocumentTemplate"("kind", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_kind_lang_key" ON "EmailTemplate"("kind", "lang");

-- CreateIndex
CREATE INDEX "EmailLog_clientId_createdAt_idx" ON "EmailLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_dismissedAt_idx" ON "Notification"("userId", "readAt", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_triggerKey_key" ON "Notification"("userId", "triggerKey");

-- CreateIndex
CREATE INDEX "Activity_clientId_createdAt_idx" ON "Activity"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "LookupValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractProduct" ADD CONSTRAINT "ContractProduct_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractProduct" ADD CONSTRAINT "ContractProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LookupValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmcScheduleLine" ADD CONSTRAINT "AmcScheduleLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
