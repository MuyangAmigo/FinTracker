-- CreateEnum
CREATE TYPE "household_role" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'INVITED', 'REVOKED');

-- CreateEnum
CREATE TYPE "account_kind" AS ENUM ('CASH', 'BANK', 'WALLET', 'CREDIT_CARD', 'BROKERAGE', 'ESPP', 'INSURANCE', 'INVESTMENT', 'LIABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "category_kind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "transaction_kind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT_CONTRIBUTION', 'INVESTMENT_WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "transaction_scope" AS ENUM ('HOUSEHOLD', 'PERSONAL');

-- CreateEnum
CREATE TYPE "budget_period" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "import_source_format" AS ENUM ('PERSONAL_OVERVIEW', 'HOUSEHOLD_MONTHLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('UPLOADED', 'PARSED', 'REVIEWING', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "import_row_status" AS ENUM ('PARSED', 'MAPPED', 'IGNORED', 'ERROR', 'COMMITTED');

-- CreateEnum
CREATE TYPE "insight_run_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "insight_kind" AS ENUM ('SUMMARY', 'ANOMALY', 'RECOMMENDATION', 'ANNUAL_REVIEW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "entraOid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "savingsGoalRate" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_memberships" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "household_role" NOT NULL DEFAULT 'MEMBER',
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "kind" "account_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "externalRef" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "sourceHash" TEXT,
    "importRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "category_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "slug" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_aliases" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "label" TEXT NOT NULL,
    "personScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "categoryId" TEXT,
    "accountId" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "kind" "transaction_kind" NOT NULL,
    "scope" "transaction_scope" NOT NULL DEFAULT 'HOUSEHOLD',
    "occurredOn" DATE NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "payee" TEXT,
    "note" TEXT,
    "personTag" TEXT,
    "sourceHash" TEXT,
    "importRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT,
    "period" "budget_period" NOT NULL,
    "periodStart" DATE NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "personTag" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "valueMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "units" DECIMAL(20,8),
    "costBasisMinor" BIGINT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "submittedById" TEXT,
    "format" "import_source_format" NOT NULL DEFAULT 'UNKNOWN',
    "status" "import_status" NOT NULL DEFAULT 'UPLOADED',
    "filename" TEXT NOT NULL,
    "blobPath" TEXT,
    "coversFrom" DATE,
    "coversTo" DATE,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sourceColumn" TEXT,
    "originalLabel" TEXT,
    "rawValue" TEXT,
    "rowHash" TEXT NOT NULL,
    "status" "import_row_status" NOT NULL DEFAULT 'PARSED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_runs" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "modelDeployment" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "insight_run_status" NOT NULL DEFAULT 'PENDING',
    "inputSnapshot" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insight_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "insightRunId" TEXT NOT NULL,
    "kind" "insight_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "feedback" INTEGER DEFAULT 0,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "actorEmail" TEXT,
    "type" TEXT NOT NULL,
    "resource" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_entraOid_key" ON "users"("entraOid");

-- CreateIndex
CREATE INDEX "household_memberships_householdId_idx" ON "household_memberships"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "household_memberships_householdId_userId_key" ON "household_memberships"("householdId", "userId");

-- CreateIndex
CREATE INDEX "accounts_householdId_kind_idx" ON "accounts"("householdId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_householdId_name_key" ON "accounts"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_importRowId_key" ON "account_snapshots"("importRowId");

-- CreateIndex
CREATE INDEX "account_snapshots_householdId_asOf_idx" ON "account_snapshots"("householdId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_accountId_asOf_key" ON "account_snapshots"("accountId", "asOf");

-- CreateIndex
CREATE INDEX "categories_householdId_kind_idx" ON "categories"("householdId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_slug_key" ON "categories"("householdId", "slug");

-- CreateIndex
CREATE INDEX "category_aliases_householdId_idx" ON "category_aliases"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "category_aliases_householdId_label_personScope_key" ON "category_aliases"("householdId", "label", "personScope");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_importRowId_key" ON "transactions"("importRowId");

-- CreateIndex
CREATE INDEX "transactions_householdId_occurredOn_idx" ON "transactions"("householdId", "occurredOn");

-- CreateIndex
CREATE INDEX "transactions_householdId_kind_occurredOn_idx" ON "transactions"("householdId", "kind", "occurredOn");

-- CreateIndex
CREATE INDEX "transactions_householdId_categoryId_occurredOn_idx" ON "transactions"("householdId", "categoryId", "occurredOn");

-- CreateIndex
CREATE INDEX "budgets_householdId_periodStart_idx" ON "budgets"("householdId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_householdId_categoryId_period_periodStart_personTag_key" ON "budgets"("householdId", "categoryId", "period", "periodStart", "personTag");

-- CreateIndex
CREATE UNIQUE INDEX "investments_householdId_name_key" ON "investments"("householdId", "name");

-- CreateIndex
CREATE INDEX "holdings_householdId_asOf_idx" ON "holdings"("householdId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_investmentId_asOf_key" ON "holdings"("investmentId", "asOf");

-- CreateIndex
CREATE INDEX "imports_householdId_createdAt_idx" ON "imports"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "import_rows_importId_status_idx" ON "import_rows"("importId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_importId_rowHash_key" ON "import_rows"("importId", "rowHash");

-- CreateIndex
CREATE INDEX "insight_runs_householdId_periodStart_idx" ON "insight_runs"("householdId", "periodStart");

-- CreateIndex
CREATE INDEX "insights_householdId_createdAt_idx" ON "insights"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_householdId_createdAt_idx" ON "audit_events"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_type_createdAt_idx" ON "audit_events"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_aliases" ADD CONSTRAINT "category_aliases_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_aliases" ADD CONSTRAINT "category_aliases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_aliases" ADD CONSTRAINT "category_aliases_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_runs" ADD CONSTRAINT "insight_runs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_insightRunId_fkey" FOREIGN KEY ("insightRunId") REFERENCES "insight_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
