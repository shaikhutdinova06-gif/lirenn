-- LIRENN MAP v2 - PostGIS Database Schema
-- This script sets up the database for soil zoning and user points

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 🌍 Soil Zones Table
CREATE TABLE IF NOT EXISTS soil_zones (
    id SERIAL PRIMARY KEY,
    zone_type TEXT NOT NULL,
    color TEXT DEFAULT '#10b981',
    description TEXT,
    geom GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index for soil zones
CREATE INDEX IF NOT EXISTS soil_zones_geom_idx ON soil_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS soil_zones_type_idx ON soil_zones (zone_type);

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

-- Insert sample soil zones (for testing)
INSERT INTO soil_zones (zone_type, color, description, geom) VALUES
    ('chernozem', '#8B4513', 'Чернозём - плодородная почва с высоким содержанием гумуса', 
     ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[37.5,55.5],[38.5,55.5],[38.5,56.0],[37.5,56.0],[37.5,55.5]]]}'))),
    ('podzol', '#D2B48C', 'Подзолистая почва - бедная гумусом, кислая', 
     ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[35.0,55.0],[36.0,55.0],[36.0,55.5],[35.0,55.5],[35.0,55.0]]]}'))),
    ('gray_forest', '#808080', 'Серая лесная почва - умеренно плодородная', 
     ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[36.0,54.5],[37.0,54.5],[37.0,55.0],[36.0,55.0],[36.0,54.5]]]}')));

-- Create function to get soil zone by point
CREATE OR REPLACE FUNCTION get_soil_zone_at_point(lat FLOAT, lng FLOAT)
RETURNS TABLE(zone_type TEXT, color TEXT, description TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT sz.zone_type, sz.color, sz.description
    FROM soil_zones sz
    WHERE ST_Intersects(sz.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust for your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
