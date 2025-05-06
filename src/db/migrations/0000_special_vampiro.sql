CREATE TYPE "public"."token_status" AS ENUM('ACTIVE', 'PENDING', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('SUCCESS', 'FAILED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('CREATION', 'TRANSFER', 'MARKET_CREATION');--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"mint_address" text NOT NULL,
	"creator_wallet" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"total_supply" bigint NOT NULL,
	"decimals" integer NOT NULL,
	"open_book_market" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "token_status" DEFAULT 'ACTIVE' NOT NULL,
	"metadata_uri" text NOT NULL,
	CONSTRAINT "tokens_mint_address_unique" UNIQUE("mint_address")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"from_wallet" text NOT NULL,
	"to_wallet" text,
	"amount" bigint,
	"tx_signature" text NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login" timestamp DEFAULT now() NOT NULL,
	"tokens_created" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_creator_wallet_users_wallet_address_fk" FOREIGN KEY ("creator_wallet") REFERENCES "public"."users"("wallet_address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_wallet_users_wallet_address_fk" FOREIGN KEY ("from_wallet") REFERENCES "public"."users"("wallet_address") ON DELETE no action ON UPDATE no action;