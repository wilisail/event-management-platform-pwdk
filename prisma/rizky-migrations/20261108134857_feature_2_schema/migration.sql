/*
  Warnings:

  - A unique constraint covering the columns `[customer_id,id]` on the table `purchases` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RESTORED');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_email" VARCHAR(254) NOT NULL,
    "user_id" UUID,
    "token_hash" VARCHAR(64) NOT NULL,
    "credential_fingerprint" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "delivery_state" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lease_id" UUID,
    "leased_until" TIMESTAMPTZ(3),
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_id" UUID NOT NULL,
    "referred_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_grants" (
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
CREATE TABLE "reward_coupons" (
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
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "coupon_id" UUID,
    "points_used" BIGINT NOT NULL DEFAULT 0,
    "coupon_discount" BIGINT NOT NULL DEFAULT 0,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(3),
    "restored_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_allocations" (
    "redemption_id" UUID NOT NULL,
    "point_grant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_allocations_pkey" PRIMARY KEY ("redemption_id","point_grant_id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "marked_by_organizer_id" UUID NOT NULL,
    "attended_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_decision_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "decision" VARCHAR(6) NOT NULL,
    "recipient_email" VARCHAR(254) NOT NULL,
    "subject" TEXT NOT NULL,
    "text_body" TEXT NOT NULL,
    "html_body" TEXT NOT NULL,
    "delivery_state" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_id" UUID,
    "leased_until" TIMESTAMPTZ(3),
    "retry_until" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),

    CONSTRAINT "organizer_decision_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_tokens_session_id_idx" ON "auth_refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "auth_refresh_tokens_expires_at_idx" ON "auth_refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_recipient_email_created_at_idx" ON "password_reset_tokens"("recipient_email", "created_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_created_at_idx" ON "password_reset_tokens"("created_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_delivery_state_next_attempt_at_idx" ON "password_reset_tokens"("delivery_state", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_created_at_idx" ON "referrals"("referrer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_id_referrer_id_key" ON "referrals"("id", "referrer_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_id_referred_user_id_key" ON "referrals"("id", "referred_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_referral_id_key" ON "point_grants"("referral_id");

-- CreateIndex
CREATE INDEX "point_grants_user_id_expires_at_idx" ON "point_grants"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_user_id_id_key" ON "point_grants"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "point_grants_referral_id_user_id_key" ON "point_grants"("referral_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_referral_id_key" ON "reward_coupons"("referral_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_code_key" ON "reward_coupons"("code");

-- CreateIndex
CREATE INDEX "reward_coupons_user_id_expires_at_idx" ON "reward_coupons"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_user_id_id_key" ON "reward_coupons"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_coupons_referral_id_user_id_key" ON "reward_coupons"("referral_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_purchase_id_key" ON "reward_redemptions"("purchase_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_reserved_at_idx" ON "reward_redemptions"("user_id", "reserved_at");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_coupon_id_idx" ON "reward_redemptions"("user_id", "coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_user_id_id_key" ON "reward_redemptions"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_user_id_purchase_id_key" ON "reward_redemptions"("user_id", "purchase_id");

-- CreateIndex
CREATE INDEX "point_allocations_user_id_redemption_id_idx" ON "point_allocations"("user_id", "redemption_id");

-- CreateIndex
CREATE INDEX "point_allocations_user_id_point_grant_id_idx" ON "point_allocations"("user_id", "point_grant_id");

-- CreateIndex
CREATE INDEX "attendance_transaction_id_idx" ON "attendance"("transaction_id");

-- CreateIndex
CREATE INDEX "attendance_marked_by_organizer_id_idx" ON "attendance"("marked_by_organizer_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_event_id_customer_id_key" ON "attendance"("event_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_decision_emails_purchase_id_key" ON "organizer_decision_emails"("purchase_id");

-- CreateIndex
CREATE INDEX "organizer_decision_emails_delivery_state_next_attempt_at_idx" ON "organizer_decision_emails"("delivery_state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "organizer_decision_emails_delivery_state_leased_until_idx" ON "organizer_decision_emails"("delivery_state", "leased_until");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_customer_id_id_key" ON "purchases"("customer_id", "id");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_referral_id_user_id_fkey" FOREIGN KEY ("referral_id", "user_id") REFERENCES "referrals"("id", "referrer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reward_coupons" ADD CONSTRAINT "reward_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reward_coupons" ADD CONSTRAINT "reward_coupons_referral_id_user_id_fkey" FOREIGN KEY ("referral_id", "user_id") REFERENCES "referrals"("id", "referred_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_purchase_id_fkey" FOREIGN KEY ("user_id", "purchase_id") REFERENCES "purchases"("customer_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_coupon_id_fkey" FOREIGN KEY ("user_id", "coupon_id") REFERENCES "reward_coupons"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_user_id_redemption_id_fkey" FOREIGN KEY ("user_id", "redemption_id") REFERENCES "reward_redemptions"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_user_id_point_grant_id_fkey" FOREIGN KEY ("user_id", "point_grant_id") REFERENCES "point_grants"("user_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_organizer_id_fkey" FOREIGN KEY ("marked_by_organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_event_id_transaction_id_fkey" FOREIGN KEY ("event_id", "transaction_id") REFERENCES "purchases"("event_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_customer_id_transaction_id_fkey" FOREIGN KEY ("customer_id", "transaction_id") REFERENCES "purchases"("customer_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organizer_decision_emails" ADD CONSTRAINT "organizer_decision_emails_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
