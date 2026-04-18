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
        SELECT id, zone_type, color,
        ST_AsMVTGeom(
          geom,
          ST_TileEnvelope($1::int,$2::int,$3::int),
          4096, 64, true
        ) AS geom
        FROM soil_zones
        WHERE geom && ST_TileEnvelope($1::int,$2::int,$3::int)
      ) q;
    `;
    const r = await pool.query(sql, [z, x, y]);
    
    if (r.rows[0] && r.rows[0].st_asmvtq) {
      res.setHeader("Content-Type", "application/x-protobuf");
      res.send(r.rows[0].st_asmvtq);
    } else {
      res.status(204).send();
    }
  } catch (error) {
    console.error("Error generating tile:", error);
    res.status(500).json({ error: "Failed to generate tile" });
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
   🌍 GET SOIL ZONES (GeoJSON)
--------------------------*/
app.get("/soil-zones", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, zone_type, color,
             ST_AsGeoJSON(geom) as geom
      FROM soil_zones
    `);
    const features = r.rows.map(row => ({
      type: "Feature",
      properties: {
        id: row.id,
        zone_type: row.zone_type,
        color: row.color
      },
      geometry: JSON.parse(row.geom)
    }));
    res.json({
      type: "FeatureCollection",
      features: features
    });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LIRENN MAP v2 API running on port ${PORT}`);
});
