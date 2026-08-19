-- =========================================================
-- Zenzero Hotel — Phase 1 schema: Room Types + Amenities
-- Date: 2026-08-19
-- Migrates data from data/mock-rooms.json + data/mock-amenities.json
-- =========================================================

create extension if not exists "uuid-ossp";

-- Enums
do $$ begin
  create type room_type_enum as enum ('Deluxe', 'Suite', 'Villa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bed_type_enum as enum ('King', 'Queen', 'Twin');
exception when duplicate_object then null; end $$;

-- =========================================================
-- amenities
-- =========================================================
create table if not exists public.amenities (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  name_th     text not null,
  icon        text not null,
  category    text not null check (category in ('comfort','tech','service')),
  created_at  timestamptz default now()
);

-- =========================================================
-- room_types
-- =========================================================
create table if not exists public.room_types (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  name            text not null,
  name_th         text not null,
  short_desc      text not null,
  description     text not null,
  base_price      numeric(10,2) not null,
  max_guests      smallint not null default 2,
  size_sqm        numeric(6,2),
  bed_type        bed_type_enum,
  floor           smallint not null default 1,
  view_label      text,
  type            room_type_enum not null,
  rating_avg      numeric(2,1) default 0,
  rating_count    int default 0,
  hero_image_key  text not null,
  gallery_keys    text[] default '{}',
  amenities       text[] default '{}',
  is_active       boolean default true,
  created_at      timestamptz default now()
);

create index if not exists idx_room_types_active on public.room_types(is_active);
create index if not exists idx_room_types_rating on public.room_types(rating_avg desc);

-- =========================================================
-- Seed: amenities
-- =========================================================
insert into public.amenities (slug, name, name_th, icon, category) values
  ('wifi', 'High-Speed Wi-Fi', 'Wi-Fi ความเร็วสูง', 'wifi', 'tech'),
  ('climate_control', 'Climate Control', 'ปรับอากาศอัตโนมัติ', 'ac_unit', 'comfort'),
  ('smart_tv', 'Smart TV', 'สมาร์ททีวี', 'tv', 'tech'),
  ('soaking_tub', 'Soaking Tub', 'อ่างอาบน้ำ', 'bathtub', 'comfort'),
  ('espresso_machine', 'Espresso Machine', 'เครื่องชงกาแฟ', 'coffee', 'service'),
  ('private_balcony', 'Private Balcony', 'ระเบียงส่วนตัว', 'deck', 'comfort'),
  ('room_service', '24/7 Room Service', 'รูมเซอร์วิส 24 ชม.', 'room_service', 'service'),
  ('valet_laundry', 'Valet Laundry', 'บริการซักรีด', 'dry_cleaning', 'service')
on conflict (slug) do nothing;

-- =========================================================
-- Seed: room_types (10 rooms from data/mock-rooms.json)
-- =========================================================
insert into public.room_types (id, slug, name, name_th, short_desc, description, base_price, max_guests, size_sqm, bed_type, floor, view_label, type, rating_avg, rating_count, hero_image_key, gallery_keys, amenities, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'serenity-suite', 'Serenity Suite', 'ห้องสวีทความสงบ',
   'A sanctuary of calm, bathed in natural light and finished with soft organic materials.',
   'Bathed in natural light and finished with soft organic materials, the Serenity Suite offers a tranquil escape from the everyday. A plush king-size bed, soaking tub, and a private balcony overlooking the forest canopy create the perfect setting for mindful rest.',
   6800, 2, 65, 'King', 3, 'Forest View', 'Suite', 4.8, 142,
   'rooms/serenity-suite/hero.webp', array['rooms/serenity-suite/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine','private_balcony'], true),

  ('00000000-0000-0000-0000-000000000002', 'botanic-king', 'Botanic King', 'ห้องคิงโรงพฤกษ์',
   'Wrapped in living greenery, this room brings the outside in with floor-to-ceiling windows.',
   'Wrapped in living greenery, this room brings the outside in with floor-to-ceiling windows and a curated palette of natural textiles. Perfect for guests seeking a quiet creative retreat.',
   5400, 2, 48, 'King', 2, 'Garden View', 'Deluxe', 4.7, 98,
   'rooms/botanic-king/hero.webp', array['rooms/botanic-king/hero.webp'],
   array['wifi','climate_control','smart_tv','espresso_machine','valet_laundry'], true),

  ('00000000-0000-0000-0000-000000000003', 'oasis-villa', 'Oasis Villa', 'วิลล่าโอเอซิส',
   'A standalone villa with private plunge pool and sun-drenched terrace.',
   'A standalone villa with private plunge pool and sun-drenched terrace. Hand-crafted furnishings, an outdoor rain shower, and direct access to the spa garden make this the most exclusive stay in the property.',
   24000, 4, 120, 'King', 1, 'Pool View', 'Villa', 5.0, 56,
   'rooms/oasis-villa/hero.webp', array['rooms/oasis-villa/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine','private_balcony','valet_laundry','room_service'], true),

  ('00000000-0000-0000-0000-000000000004', 'heritage-twin', 'Heritage Twin', 'ห้องเฮอริเทจทวิน',
   'Two sumptuous beds in a refined setting inspired by the propertys original teak architecture.',
   'Two sumptuous beds in a refined setting inspired by the propertys original teak architecture. Ideal for families or friends travelling together.',
   7900, 3, 58, 'Twin', 4, 'Courtyard View', 'Suite', 4.6, 73,
   'rooms/heritage-twin/hero.webp', array['rooms/heritage-twin/hero.webp'],
   array['wifi','climate_control','smart_tv','espresso_machine','valet_laundry'], true),

  ('00000000-0000-0000-0000-000000000005', 'ocean-grand-deluxe', 'Ocean Grand Deluxe', 'ห้องดีลักซ์โอเชียนแกรนด์',
   'Wake to uninterrupted ocean horizons from your king-size bed.',
   'Wake to uninterrupted ocean horizons from your king-size bed. An expansive marble bathroom, deep soaking tub, and curated minibar complete the experience.',
   5200, 3, 45, 'King', 3, 'Ocean View', 'Deluxe', 4.5, 124,
   'rooms/ocean-grand-deluxe/hero.webp', array['rooms/ocean-grand-deluxe/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine'], true),

  ('00000000-0000-0000-0000-000000000006', 'ocean-twin-premium', 'Ocean Twin Premium', 'ห้องพรีเมียมทวินโอเชียน',
   'Two plush beds with private balcony and full ocean panorama.',
   'Two plush beds with private balcony and full ocean panorama. Modern amenities meet timeless coastal design.',
   4800, 4, 48, 'Twin', 3, 'Ocean View', 'Deluxe', 4.0, 89,
   'rooms/ocean-twin-premium/hero.webp', array['rooms/ocean-twin-premium/hero.webp'],
   array['wifi','climate_control','smart_tv','espresso_machine','private_balcony'], true),

  ('00000000-0000-0000-0000-000000000007', 'executive-corner-suite', 'Executive Corner Suite', 'ห้องเอ็กเซกคิวทีฟคอร์เนอร์',
   'Panoramic corner views with separate living area and curated Club Benefits.',
   'Panoramic corner views with separate living area and curated Club Benefits including complimentary breakfast, evening cocktails, and access to the Executive Lounge.',
   8500, 2, 65, 'King', 4, 'Ocean View', 'Suite', 5.0, 42,
   'rooms/executive-corner-suite/hero.webp', array['rooms/executive-corner-suite/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine','private_balcony','room_service','valet_laundry'], true),

  ('00000000-0000-0000-0000-000000000008', 'the-heritage-suite', 'The Heritage Suite', 'เดอะเฮอริเทจสวีท',
   'Our signature suite — 85 sqm of curated luxury with private balcony.',
   'Our signature suite — 85 sqm of curated luxury with private balcony overlooking the resorts original teak gardens. Includes complimentary airport transfer, daily breakfast, and an in-suite welcome ceremony.',
   12500, 3, 85, 'King', 4, 'Garden View', 'Suite', 4.9, 128,
   'rooms/the-heritage-suite/hero.webp', array['rooms/the-heritage-suite/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine','private_balcony','room_service','valet_laundry'], true),

  ('00000000-0000-0000-0000-000000000009', 'deluxe-forest-suite', 'Deluxe Forest Suite', 'ห้องดีลักซ์ฟอเรสต์',
   'Tucked into the treetops with sweeping views of the surrounding forest.',
   'Tucked into the treetops with sweeping views of the surrounding forest. A tranquil retreat with rainfall shower and locally-sourced organic amenities.',
   6900, 2, 55, 'King', 2, 'Forest View', 'Suite', 4.7, 67,
   'rooms/deluxe-forest-suite/hero.webp', array['rooms/deluxe-forest-suite/hero.webp'],
   array['wifi','climate_control','smart_tv','espresso_machine','private_balcony'], true),

  ('00000000-0000-0000-0000-000000000010', 'garden-view-pavilion', 'Garden View Pavilion', 'เกสท์เฮาส์สวน',
   'A freestanding pavilion with direct access to the resorts garden pool.',
   'A freestanding pavilion with direct access to the resorts garden pool. Indoor-outdoor living at its finest, with a private outdoor terrace and soaking tub.',
   9800, 2, 70, 'King', 1, 'Pool View', 'Villa', 4.8, 91,
   'rooms/garden-view-pavilion/hero.webp', array['rooms/garden-view-pavilion/hero.webp'],
   array['wifi','climate_control','smart_tv','soaking_tub','espresso_machine','private_balcony','room_service'], true)
on conflict (id) do nothing;
