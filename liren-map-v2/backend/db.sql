-- LIRENN MAP v2 - PostGIS Database Schema
-- This script sets up the database for Russian soil zoning and user points

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 🌍 Soil Zones Table (Russian Soil Data)
CREATE TABLE IF NOT EXISTS soil_zones (
    id SERIAL PRIMARY KEY,
    soil_type TEXT,
    soil_name TEXT,
    zone_type TEXT,
    color TEXT DEFAULT '#10b981',
    description TEXT,
    geom GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index for soil zones
CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS soil_zones_type_idx ON soil_zones (zone_type);
CREATE INDEX IF NOT EXISTS soil_zones_soil_type_idx ON soil_zones (soil_type);

-- 📍 User Points Table
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id TEXT DEFAULT 'anon',
    title TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    geom GEOMETRY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index for user points
CREATE INDEX IF NOT EXISTS user_points_geom_idx ON user_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS user_points_user_idx ON user_points (user_id);
CREATE INDEX IF NOT EXISTS user_points_created_idx ON user_points (created_at DESC);

-- NOTE: Sample soil zones removed. Load real Russian soil data using setup-russia-soils.sh
-- See SOIL_DATA_SETUP.md for instructions

-- Create function to get soil zone by point
CREATE OR REPLACE FUNCTION get_soil_zone_at_point(lat FLOAT, lng FLOAT)
RETURNS TABLE(soil_type TEXT, zone_type TEXT, color TEXT, description TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT sz.soil_type, sz.zone_type, sz.color, sz.description
    FROM soil_zones sz
    WHERE ST_Intersects(sz.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
