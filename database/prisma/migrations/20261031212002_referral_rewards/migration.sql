BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Referral/reward storage foundation; existing users/events/purchases are preserved.
-- Structural SQL generated from the validated Prisma model; checks/access below are explicit.
-- CreateEnum
CREATE TYPE "temuevent"."RewardRedemptionStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RESTORED');

-- CreateTable
CREATE TABLE "temuevent"."referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_id" UUID NOT NULL,
    "referred_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuevent"."point_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "remaining_amount" BIGINT NOT NULL,
    "credited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuevent"."reward_coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "discount_value" BIGINT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuevent"."reward_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "coupon_id" UUID,
    "points_used" BIGINT NOT NULL DEFAULT 0,
    "coupon_discount" BIGINT NOT NULL DEFAULT 0,
    "status" "temuevent"."RewardRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(3),
    "restored_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuevent"."point_allocations" (
    "redemption_id" UUID NOT NULL,
    "point_grant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_allocations_pkey" PRIMARY KEY ("redemption_id","point_grant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "temuevent"."referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_created_at_idx" ON "temuevent"."referrals"("referrer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_id_referrer_id_key" ON "temuevent"."referrals"("id", "referrer_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_id_referred_user_id_key" ON "temuevent"."referrals"("id", "referred_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_referral_id_key" ON "temuevent"."point_grants"("referral_id");

-- CreateIndex
CREATE INDEX "point_grants_user_id_expires_at_idx" ON "temuevent"."point_grants"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_user_id_id_key" ON "temuevent"."point_grants"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_referral_id_user_id_key" ON "temuevent"."point_grants"("referral_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_referral_id_key" ON "temuevent"."reward_coupons"("referral_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_code_key" ON "temuevent"."reward_coupons"("code");

-- CreateIndex
CREATE INDEX "reward_coupons_user_id_expires_at_idx" ON "temuevent"."reward_coupons"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_user_id_id_key" ON "temuevent"."reward_coupons"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_referral_id_user_id_key" ON "temuevent"."reward_coupons"("referral_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_purchase_id_key" ON "temuevent"."reward_redemptions"("purchase_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_reserved_at_idx" ON "temuevent"."reward_redemptions"("user_id", "reserved_at");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_coupon_id_idx" ON "temuevent"."reward_redemptions"("user_id", "coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_user_id_id_key" ON "temuevent"."reward_redemptions"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_user_id_purchase_id_key" ON "temuevent"."reward_redemptions"("user_id", "purchase_id");

-- CreateIndex
CREATE INDEX "point_allocations_user_id_redemption_id_idx" ON "temuevent"."point_allocations"("user_id", "redemption_id");

-- CreateIndex
CREATE INDEX "point_allocations_user_id_point_grant_id_idx" ON "temuevent"."point_allocations"("user_id", "point_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_customer_id_id_key" ON "temuevent"."purchases"("customer_id", "id");

-- AddForeignKey
ALTER TABLE "temuevent"."referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "temuevent"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "temuevent"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."point_grants" ADD CONSTRAINT "point_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "temuevent"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."point_grants" ADD CONSTRAINT "point_grants_referral_id_user_id_fkey" FOREIGN KEY ("referral_id", "user_id") REFERENCES "temuevent"."referrals"("id", "referrer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."reward_coupons" ADD CONSTRAINT "reward_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "temuevent"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."reward_coupons" ADD CONSTRAINT "reward_coupons_referral_id_user_id_fkey" FOREIGN KEY ("referral_id", "user_id") REFERENCES "temuevent"."referrals"("id", "referred_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "temuevent"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_purchase_id_fkey" FOREIGN KEY ("user_id", "purchase_id") REFERENCES "temuevent"."purchases"("customer_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_coupon_id_fkey" FOREIGN KEY ("user_id", "coupon_id") REFERENCES "temuevent"."reward_coupons"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."point_allocations" ADD CONSTRAINT "point_allocations_user_id_redemption_id_fkey" FOREIGN KEY ("user_id", "redemption_id") REFERENCES "temuevent"."reward_redemptions"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "temuevent"."point_allocations" ADD CONSTRAINT "point_allocations_user_id_point_grant_id_fkey" FOREIGN KEY ("user_id", "point_grant_id") REFERENCES "temuevent"."point_grants"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- SQL invariants and access rules not represented by the Prisma models.
ALTER TABLE temuevent.referrals
  ADD CONSTRAINT referrals_not_self CHECK (referrer_id <> referred_user_id);

ALTER TABLE temuevent.point_grants
  ADD CONSTRAINT point_grants_positive_amount CHECK (amount > 0 AND amount <= 9007199254740991),
  ADD CONSTRAINT point_grants_remaining_bounds CHECK (remaining_amount >= 0 AND remaining_amount <= amount),
  ADD CONSTRAINT point_grants_expiry_order CHECK (expires_at > credited_at);

ALTER TABLE temuevent.reward_coupons
  ADD CONSTRAINT reward_coupons_code_normalized CHECK (char_length(code) >= 4 AND code = upper(btrim(code))),
  ADD CONSTRAINT reward_coupons_positive_value CHECK (discount_value > 0 AND discount_value <= 9007199254740991),
  ADD CONSTRAINT reward_coupons_expiry_order CHECK (expires_at > issued_at);

ALTER TABLE temuevent.reward_redemptions
  ADD CONSTRAINT reward_redemptions_points_bounds CHECK (points_used >= 0 AND points_used <= 9007199254740991),
  ADD CONSTRAINT reward_redemptions_coupon_bounds CHECK (coupon_discount >= 0 AND coupon_discount <= 9007199254740991),
  ADD CONSTRAINT reward_redemptions_coupon_link CHECK (
    (coupon_id IS NULL AND coupon_discount = 0) OR (coupon_id IS NOT NULL AND coupon_discount > 0)
  ),
  ADD CONSTRAINT reward_redemptions_not_empty CHECK (points_used > 0 OR coupon_discount > 0),
  ADD CONSTRAINT reward_redemptions_timestamp_state CHECK (
    (status = 'RESERVED' AND consumed_at IS NULL AND restored_at IS NULL)
    OR (status = 'CONSUMED' AND consumed_at IS NOT NULL AND restored_at IS NULL)
    OR (status = 'RESTORED' AND restored_at IS NOT NULL)
  ),
  ADD CONSTRAINT reward_redemptions_time_order CHECK (
    (consumed_at IS NULL OR consumed_at >= reserved_at)
    AND (restored_at IS NULL OR restored_at >= reserved_at)
    AND (consumed_at IS NULL OR restored_at IS NULL OR restored_at >= consumed_at)
  );

ALTER TABLE temuevent.point_allocations
  ADD CONSTRAINT point_allocations_positive_amount CHECK (amount > 0 AND amount <= 9007199254740991);

-- A returned coupon may be reserved again; a reserved/consumed coupon may not.
CREATE UNIQUE INDEX reward_redemptions_active_coupon_key
  ON temuevent.reward_redemptions(coupon_id)
  WHERE coupon_id IS NOT NULL AND status IN ('RESERVED', 'CONSUMED');

-- Express/Prisma use the existing backend role. These are not Data API tables.
ALTER TABLE temuevent.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.point_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.reward_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.point_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON temuevent.referrals, temuevent.point_grants, temuevent.reward_coupons,
  temuevent.reward_redemptions, temuevent.point_allocations
  FROM PUBLIC, anon, authenticated, service_role, temuevent_app;

GRANT SELECT, INSERT ON temuevent.referrals, temuevent.reward_coupons,
  temuevent.point_allocations TO temuevent_app;
GRANT SELECT, INSERT, UPDATE ON temuevent.point_grants,
  temuevent.reward_redemptions TO temuevent_app;

CREATE POLICY referrals_backend_access ON temuevent.referrals
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
CREATE POLICY point_grants_backend_access ON temuevent.point_grants
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
CREATE POLICY reward_coupons_backend_access ON temuevent.reward_coupons
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
CREATE POLICY reward_redemptions_backend_access ON temuevent.reward_redemptions
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
CREATE POLICY point_allocations_backend_access ON temuevent.point_allocations
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);

COMMIT;
