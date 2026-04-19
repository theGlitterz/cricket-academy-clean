CREATE TYPE "public"."availability_status" AS ENUM('available', 'booked', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending_review', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_id" text NOT NULL,
	"facility_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"slot_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"player_whatsapp" text NOT NULL,
	"player_email" text,
	"booking_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"screenshot_url" text,
	"payment_status" "payment_status" DEFAULT 'pending_review' NOT NULL,
	"booking_status" "booking_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_id_unique" UNIQUE("reference_id")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_name" text NOT NULL,
	"coach_name" text,
	"coach_whatsapp" text,
	"upi_id" text,
	"upi_qr_image_url" text,
	"address" text,
	"working_hours" text,
	"payment_instructions" text,
	"google_maps_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"active_status" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"availability_status" "availability_status" DEFAULT 'available' NOT NULL,
	"max_capacity" integer DEFAULT 1 NOT NULL,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
