-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE', 'MAINTAIN', 'GAIN');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('G', 'ML', 'PCS');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('VEGETABLES', 'FRUITS', 'DAIRY', 'MEAT_FISH', 'GROCERY', 'BAKERY', 'EGGS', 'OTHER');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "firstFailedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Ижевск',
    "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
    "repeatLimitPerWeek" INTEGER NOT NULL DEFAULT 2,
    "monthlyBudgetRub" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "sex" "Sex" NOT NULL,
    "age" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" DECIMAL(5,1) NOT NULL,
    "activityFactor" DECIMAL(4,3) NOT NULL,
    "goal" "Goal" NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergen" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "MemberAllergen" (
    "memberId" UUID NOT NULL,
    "allergenCode" TEXT NOT NULL,

    CONSTRAINT "MemberAllergen_pkey" PRIMARY KEY ("memberId","allergenCode")
);

-- CreateTable
CREATE TABLE "MemberExclusion" (
    "memberId" UUID NOT NULL,
    "ingredientId" INTEGER NOT NULL,

    CONSTRAINT "MemberExclusion_pkey" PRIMARY KEY ("memberId","ingredientId")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "baseUnit" "Unit" NOT NULL,
    "gramsPerPiece" DECIMAL(7,1),

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAllergen" (
    "ingredientId" INTEGER NOT NULL,
    "allergenCode" TEXT NOT NULL,

    CONSTRAINT "IngredientAllergen_pkey" PRIMARY KEY ("ingredientId","allergenCode")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "baseServings" INTEGER NOT NULL,
    "kcalPerServing" INTEGER NOT NULL,
    "proteinG" DECIMAL(6,1),
    "fatG" DECIMAL(6,1),
    "carbsG" DECIMAL(6,1),
    "cookTimeMin" INTEGER NOT NULL,
    "steps" TEXT[],
    "compositionComplete" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "dishId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" DECIMAL(8,1) NOT NULL,
    "unit" "Unit" NOT NULL,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("dishId","ingredientId")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "mealsPerDay" INTEGER NOT NULL,
    "dailyKcalTarget" INTEGER NOT NULL,
    "budgetRub" DECIMAL(10,2) NOT NULL,
    "needsRecheck" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedMeal" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "mealType" "MealType" NOT NULL,
    "dishId" INTEGER NOT NULL,
    "servings" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "PlannedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingMark" (
    "planId" UUID NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "atHomeQty" DECIMAL(8,1) NOT NULL DEFAULT 0,

    CONSTRAINT "ShoppingMark_pkey" PRIMARY KEY ("planId","ingredientId")
);

-- CreateTable
CREATE TABLE "RetailChain" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RetailChain_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "chainCode" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "packSize" DECIMAL(8,1) NOT NULL,
    "packUnit" "Unit" NOT NULL,
    "priceRub" DECIMAL(10,2) NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Dish_name_key" ON "Dish"("name");

-- CreateIndex
CREATE INDEX "Dish_mealType_idx" ON "Dish"("mealType");

-- CreateIndex
CREATE INDEX "MealPlan_userId_idx" ON "MealPlan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedMeal_planId_dayIndex_slot_key" ON "PlannedMeal"("planId", "dayIndex", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Product_chainCode_ingredientId_key" ON "Product"("chainCode", "ingredientId");

-- CreateIndex
CREATE INDEX "AiAnalysis_planId_idx" ON "AiAnalysis"("planId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAllergen" ADD CONSTRAINT "MemberAllergen_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAllergen" ADD CONSTRAINT "MemberAllergen_allergenCode_fkey" FOREIGN KEY ("allergenCode") REFERENCES "Allergen"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberExclusion" ADD CONSTRAINT "MemberExclusion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberExclusion" ADD CONSTRAINT "MemberExclusion_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAllergen" ADD CONSTRAINT "IngredientAllergen_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAllergen" ADD CONSTRAINT "IngredientAllergen_allergenCode_fkey" FOREIGN KEY ("allergenCode") REFERENCES "Allergen"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedMeal" ADD CONSTRAINT "PlannedMeal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedMeal" ADD CONSTRAINT "PlannedMeal_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingMark" ADD CONSTRAINT "ShoppingMark_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingMark" ADD CONSTRAINT "ShoppingMark_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_chainCode_fkey" FOREIGN KEY ("chainCode") REFERENCES "RetailChain"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
