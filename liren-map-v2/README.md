# LIRENN MAP v2 - Soil Zoning & User Points GIS Service

Production-ready GIS platform with soil zoning, interactive map, user points, photos, and PostGIS backend.

## 🌟 Features

- 🌍 **Soil Zoning**: Interactive soil zones with vector tiles
- 📍 **User Points**: Add custom points with photos and descriptions
- 🗺️ **Interactive Map**: Leaflet-based map with modern UI
- 🐘 **PostGIS**: Full GIS database with spatial indexing
- 📷 **Photo Upload**: Attach photos to user points
- 🔌 **REST API**: Complete backend API for all operations
- 🐳 **Docker**: Ready-to-deploy with Docker Compose
- ☁️ **Render Ready**: Deploy to Render with one click

## 📁 Project Structure

```
liren-map-v2/
├── backend/
│   ├── server.js          # Express API server
│   ├── db.sql             # PostGIS database schema
│   ├── download.sh        # Soil data download script
│   ├── package.json       # Node.js dependencies
│   └── uploads/           # Uploaded photos (auto-created)
├── frontend/
│   ├── index.html         # Main HTML page
│   ├── map.js             # Leaflet map logic
│   └── style.css          # Modern styling
├── docker-compose.yml      # Docker configuration
└── README.md             # This file
```

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- PostgreSQL with PostGIS extension
- GDAL (for soil data download)

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Database

```bash
# Create database
createdb liren

# Enable PostGIS
psql -d liren -c "CREATE EXTENSION postgis;"

# Run schema
psql -d liren -f db.sql
```

### 3. Configure Environment

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/liren"
export PORT=3000
```

### 4. Start Backend

```bash
cd backend
npm start
```

### 5. Serve Frontend

```bash
cd frontend
python -m http.server 8000
# or use any static file server
```

### 6. Open in Browser

```
http://localhost:8000
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The API will be available at `http://localhost:3000`

## ☁️ Render Deployment

### Backend Deployment

1. **Create Render Web Service**
   - Connect your GitHub repository
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables:
     - `DATABASE_URL`: Your Render PostgreSQL connection string
     - `PORT`: 3000

2. **Create Render PostgreSQL**
   - Create a new PostgreSQL database
   - Copy the internal connection string
   - Add it as `DATABASE_URL` to your web service

### Database Setup on Render

1. Access your PostgreSQL database via pgAdmin or psql
2. Run the schema:

```bash
psql -h <render-host> -U <user> -d <database> -f backend/db.sql
```

### Frontend Deployment

**Option 1: Static Site on Render**
1. Create a new Static Site on Render
2. Connect your repository
3. Root directory: `frontend`
4. Build command: (empty)
5. Publish directory: `.`

**Option 2: Integrate with Existing LIRENN Site**
Replace the current `map.js` in your LIRENN frontend with the new `map.js` from this project.

## 📥 Download Soil Data

### Using the Download Script

```bash
cd backend
chmod +x download.sh
export DATABASE_URL="postgresql://user:password@localhost:5432/liren"
./download.sh
```

This will:
1. Download soil data from SoilGrids
2. Convert raster to GeoJSON polygons
3. Import into PostGIS database

### Manual Data Import

If you have your own soil data in GeoJSON format:

```bash
ogr2ogr -f "PostgreSQL" \
  PG:"$DATABASE_URL" \
  your_data.geojson \
  -nln soil_zones
```

## 🔌 API Endpoints

### Soil Zones

- `GET /soil-zones` - Get all soil zones as GeoJSON
- `POST /soil-zones` - Add new soil zone
- `GET /tiles/:z/:x/:y` - Get vector tiles for map

### User Points

- `GET /points` - Get all user points
- `POST /points` - Create new point (with photo upload)
- `DELETE /points/:id` - Delete a point

### Health Check

- `GET /health` - API health status

## 🎨 Customization

### Change API URL

Edit `frontend/map.js`:

```javascript
const API_URL = 'https://your-api.onrender.com';
```

### Customize Soil Zone Colors

Edit `frontend/map.js` or add custom colors in the database.

### Adjust Map Style

Edit `frontend/style.css` to customize the UI.

## 📱 Features

### Adding Points

1. Click "➕ Добавить точку" button
2. Click on the map to select location
3. Fill in the form:
   - Title (required)
   - Description (optional)
   - Photo (optional)
4. Click "💾 Сохранить"

### Viewing Soil Zones

- Toggle soil zones with "🌍 Почвенные зоны" button
- Click on zones to see details

### Managing Points

- Refresh points with "🔄 Обновить точки" button
- Click on markers to see point details and photos

## 🔧 Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED
```

- Check that PostgreSQL is running
- Verify DATABASE_URL is correct
- Ensure PostGIS extension is enabled

### GDAL Not Found

```
gdal_polygonize.py: command not found
```

Install GDAL:
- Ubuntu/Debian: `sudo apt-get install gdal-bin python3-gdal`
- macOS: `brew install gdal`
- Windows: Download from OSGeo4W

### Photo Upload Fails

- Check that `uploads/` directory exists and is writable
- Verify file size limits in your server configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🌐 Live Demo

Coming soon! Deploy to Render to see it in action.

## 💡 Next Steps

- 🔥 React UI like Google Maps
- 🔥 Heatmap soil analysis
- 🔥 User accounts and authentication
- 🔥 SaaS version of LIRENN
- 🔥 Advanced soil analytics

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ for LIRENN**
