import express from "express";
import pg from "pg";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* -------------------------
   🌍 SOIL ZONING (vector tiles)
--------------------------*/
app.get("/tiles/:z/:x/:y", async (req, res) => {
  const { z, x, y } = req.params;
  try {
    const sql = `
      SELECT ST_AsMVT(q, 'soil_zones', 4096, 'geom')
      FROM (
        SELECT id, soil_type, zone_type, color, description,
        ST_AsMVTGeom(
          ST_Transform(geom, 4326),
          ST_TileEnvelope($1::int,$2::int,$3::int),
          4096, 64, true
        ) AS geom
        FROM soil_zones
        WHERE ST_Transform(geom, 4326) && ST_TileEnvelope($1::int,$2::int,$3::int)
      ) q;
    `;
    const r = await pool.query(sql, [z, x, y]);
    
    if (r.rows.length === 0 || !r.rows[0].st_asmvtq) {
      res.status(204).send();
      return;
    }
    
    res.setHeader("Content-Type", "application/x-protobuf");
    res.send(r.rows[0].st_asmvtq);
  } catch (error) {
    console.error("Tile error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------
   📍 GET POINTS
--------------------------*/
app.get("/points", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, user_id, title, description, photo_url,
             ST_X(geom) as lng, ST_Y(geom) as lat,
             created_at
      FROM user_points
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("Error fetching points:", error);
    res.status(500).json({ error: "Failed to fetch points" });
  }
});

/* -------------------------
   📍 CREATE POINT
--------------------------*/
app.post("/points", upload.single("photo"), async (req, res) => {
  try {
    const { title, description, lat, lng, user_id } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    const r = await pool.query(
      `INSERT INTO user_points
       (user_id, title, description, photo_url, geom)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($6, $5), 4326))
       RETURNING id, user_id, title, description, photo_url,
                ST_X(geom) as lng, ST_Y(geom) as lat, created_at`,
      [user_id || 'anon', title, description, photo_url, lat, lng]
    );
    res.json(r.rows[0]);
  } catch (error) {
    console.error("Error creating point:", error);
    res.status(500).json({ error: "Failed to create point" });
  }
});

/* -------------------------
   📍 DELETE POINT
--------------------------*/
app.delete("/points/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM user_points WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting point:", error);
    res.status(500).json({ error: "Failed to delete point" });
  }
});

/* -------------------------
   🌍 CHECK SOIL ZONES COUNT
--------------------------*/
app.get("/soil-zones-count", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*) as count FROM soil_zones");
    res.json({ count: r.rows[0].count });
  } catch (error) {
    console.error("Error counting soil zones:", error);
    res.status(500).json({ error: "Failed to count soil zones" });
  }
});

/* -------------------------
   🌍 GET SOIL ZONES (raw x, y, srid)
--------------------------*/
app.get("/soil-zones", async (req, res) => {
  try {
    // Query raw coordinate values (ST_X, ST_Y) to see actual stored values
    const r = await pool.query(`
      SELECT id, zone_type, color,
             ST_X(geom) as x, ST_Y(geom) as y,
             ST_SRID(geom) as srid
      FROM soil_zones
      LIMIT 5
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("Error fetching soil zones:", error);
    res.status(500).json({ error: "Failed to fetch soil zones" });
  }
});

/* -------------------------
   🌍 ADD SOIL ZONE
--------------------------*/
app.post("/soil-zones", async (req, res) => {
  try {
    const { zone_type, color, geojson } = req.body;
    const r = await pool.query(
      `INSERT INTO soil_zones (zone_type, color, geom)
       VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))
       RETURNING *`,
      [zone_type, color, JSON.stringify(geojson)]
    );
    res.json(r.rows[0]);
  } catch (error) {
    console.error("Error adding soil zone:", error);
    res.status(500).json({ error: "Failed to add soil zone" });
  }
});

// Serve uploaded files
app.use("/uploads", express.static(uploadsDir));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug endpoint to check database state
app.get("/debug/db", async (req, res) => {
  try {
    // Check database connection first
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      return res.status(500).json({ 
        error: "Database connection failed", 
        details: err.message 
      });
    }
    
    // Check if tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Check soil_zones count
    let soilZonesCount = 0;
    let soilZonesData = [];
    let soilZonesError = null;
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM soil_zones');
      soilZonesCount = countResult.rows[0].count;
      
      const dataResult = await pool.query('SELECT * FROM soil_zones LIMIT 5');
      soilZonesData = dataResult.rows;
    } catch (err) {
      soilZonesError = err.message;
    }
    
    // Check user_points count
    let userPointsCount = 0;
    let userPointsError = null;
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM user_points');
      userPointsCount = countResult.rows[0].count;
    } catch (err) {
      userPointsError = err.message;
    }
    
    res.json({
      tables: tablesCheck.rows.map(r => r.table_name),
      soilZones: {
        count: soilZonesCount,
        sample: soilZonesData,
        error: soilZonesError
      },
      userPoints: {
        count: userPointsCount,
        error: userPointsError
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: error.message || "Unknown error",
      stack: error.stack 
    });
  }
});

// Debug endpoint to test SRID transformations for soil zones
app.get("/debug/test-srid", async (req, res) => {
  try {
    // Test different source SRIDs to find which produces valid WGS84 coordinates
    const testQuery = `
      WITH test_transforms AS (
        SELECT 
          id,
          ST_X(ST_Centroid(geom)) as orig_x,
          ST_Y(ST_Centroid(geom)) as orig_y,
          -- Test EPSG:32637 (WGS 84 / UTM zone 37N)
          ST_X(ST_Transform(ST_SetSRID(ST_Centroid(geom), 32637), 4326)) as lon_32637,
          ST_Y(ST_Transform(ST_SetSRID(ST_Centroid(geom), 32637), 4326)) as lat_32637,
          -- Test EPSG:32638 (WGS 84 / UTM zone 38N)
          ST_X(ST_Transform(ST_SetSRID(ST_Centroid(geom), 32638), 4326)) as lon_32638,
          ST_Y(ST_Transform(ST_SetSRID(ST_Centroid(geom), 32638), 4326)) as lat_32638,
          -- Test EPSG:28403 (Pulkovo 1942 / Gauss-Kruger zone 3)
          ST_X(ST_Transform(ST_SetSRID(ST_Centroid(geom), 28403), 4326)) as lon_28403,
          ST_Y(ST_Transform(ST_SetSRID(ST_Centroid(geom), 28403), 4326)) as lat_28403,
          -- Test EPSG:28404 (Pulkovo 1942 / Gauss-Kruger zone 4)
          ST_X(ST_Transform(ST_SetSRID(ST_Centroid(geom), 28404), 4326)) as lon_28404,
          ST_Y(ST_Transform(ST_SetSRID(ST_Centroid(geom), 28404), 4326)) as lat_28404
        FROM soil_zones
        LIMIT 10
      )
      SELECT 
        id,
        orig_x, orig_y,
        lon_32637, lat_32637,
        lon_32638, lat_32638,
        lon_28403, lat_28403,
        lon_28404, lat_28404,
        -- Check which are in valid WGS84 range
        CASE WHEN lon_32637 BETWEEN -180 AND 180 AND lat_32637 BETWEEN -90 AND 90 THEN 'VALID' ELSE 'INVALID' END as status_32637,
        CASE WHEN lon_32638 BETWEEN -180 AND 180 AND lat_32638 BETWEEN -90 AND 90 THEN 'VALID' ELSE 'INVALID' END as status_32638,
        CASE WHEN lon_28403 BETWEEN -180 AND 180 AND lat_28403 BETWEEN -90 AND 90 THEN 'VALID' ELSE 'INVALID' END as status_28403,
        CASE WHEN lon_28404 BETWEEN -180 AND 180 AND lat_28404 BETWEEN -90 AND 90 THEN 'VALID' ELSE 'INVALID' END as status_28404
      FROM test_transforms
    `;
    
    const result = await pool.query(testQuery);
    
    res.json({
      success: true,
      tests: result.rows,
      summary: {
        total_tested: result.rows.length,
        valid_32637: result.rows.filter(r => r.status_32637 === 'VALID').length,
        valid_32638: result.rows.filter(r => r.status_32638 === 'VALID').length,
        valid_28403: result.rows.filter(r => r.status_28403 === 'VALID').length,
        valid_28404: result.rows.filter(r => r.status_28404 === 'VALID').length,
      }
    });
  } catch (error) {
    console.error('SRID test error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

const PORT = process.env.PORT || 3000;

// Auto-migrate database on startup
async function migrateDatabase() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const sqlPath = path.join(__dirname, 'db.sql');
    
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Enable PostGIS extensions first
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
        console.log('PostGIS extensions enabled');
      } catch (err) {
        console.error('Failed to enable PostGIS:', err.message);
      }
      
      // Execute SQL as a single transaction
      try {
        await pool.query(sql);
        console.log('Database migration completed successfully');
      } catch (err) {
        console.error('Migration error:', err.message);
        
        // If single execution fails, try statement by statement
        console.log('Trying statement-by-statement execution...');
        
        // Split by semicolons but preserve function definitions
        const statements = [];
        let currentStatement = '';
        let inFunction = false;
        
        for (const line of sql.split('\n')) {
          if (line.trim().startsWith('CREATE OR REPLACE FUNCTION') || line.trim().startsWith('CREATE FUNCTION')) {
            inFunction = true;
          }
          
          currentStatement += line + '\n';
          
          if (inFunction && line.trim().endsWith('$$ LANGUAGE plpgsql;')) {
            inFunction = false;
            statements.push(currentStatement.trim());
            currentStatement = '';
          } else if (!inFunction && line.trim().endsWith(';')) {
            statements.push(currentStatement.trim());
            currentStatement = '';
          }
        }
        
        for (const statement of statements) {
          if (statement.length === 0 || statement.startsWith('--')) continue;
          
          try {
            await pool.query(statement);
            console.log('Executed:', statement.substring(0, 50) + '...');
          } catch (err) {
            if (err.message.includes('already exists')) {
              console.log('Already exists, skipping');
            } else {
              console.error('Error:', err.message);
            }
          }
        }
      }
      
      console.log('Database migration completed');
    } else {
      console.log('db.sql not found, skipping migration');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration before starting server
migrateDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`LIRENN MAP v2 API running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
