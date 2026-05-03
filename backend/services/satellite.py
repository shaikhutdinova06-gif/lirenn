"""
Satellite imagery service using Sentinel Hub API
Provides real satellite images from Sentinel-2
Uses Instance ID authentication (simpler than OAuth)
"""
import requests
import os
from datetime import datetime, timedelta
import base64
from typing import Dict, Any

# Load credentials from environment
INSTANCE_ID = os.getenv("SENTINEL_INSTANCE_ID", "PLAK1e9d4e8d569b4660af940ff20a9865cb")

# OAuth credentials for Sentinel Hub (for high-res NDVI)
CLIENT_ID = os.getenv("SENTINEL_CLIENT_ID", "TcXdcr0FAOkbwGfFC1PNgeRNJUX4H1T6")
CLIENT_SECRET = os.getenv("SENTINEL_CLIENT_SECRET", "a9ae8169-9c86-4bc9-a64b-ad907736c1f9")

# Cache for OAuth token
_oauth_token = None
_token_expires = None

def get_sentinel_oauth_token():
    """Get OAuth token for Sentinel Hub with caching"""
    global _oauth_token, _token_expires
    
    # Check if token is still valid (cache for 55 minutes)
    if _oauth_token and _token_expires and datetime.utcnow() < _token_expires:
        return _oauth_token
    
    print(f"[SATELLITE] Getting new OAuth token...")
    
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError("SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET not set")
    
    url = "https://services.sentinel-hub.com/oauth/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }
    
    try:
        res = requests.post(url, data=data, timeout=30)
        res.raise_for_status()
        result = res.json()
        _oauth_token = result["access_token"]
        # Token expires in 1 hour, cache for 55 minutes
        _token_expires = datetime.utcnow() + timedelta(minutes=55)
        print(f"[SATELLITE] OAuth token obtained, expires in 60 min")
        return _oauth_token
    except Exception as e:
        print(f"[SATELLITE] OAuth error: {e}")
        raise

def get_auth_headers() -> dict:
    """
    Get authentication headers for Sentinel Hub
    Uses Instance ID in URL
    """
    print(f"[SATELLITE] Using Instance ID: {INSTANCE_ID[:15]}...")
    return {
        "Content-Type": "application/json"
    }

def get_instance_url() -> str:
    """
    Get URL with instance ID
    """
    return f"https://services.sentinel-hub.com/api/v1/process"

def get_satellite_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get satellite image from NASA GIBS (Global Imagery Browse Services)
    Free, no API key required, covers entire Earth including Russia
    """
    print(f"[SATELLITE] get_satellite_image() called: lat={lat}, lng={lng}")
    
    try:
        # NASA GIBS Web Map Tile Service (WMTS)
        # Using Landsat-8 for better resolution (30m vs 250m MODIS)
        
        today = datetime.utcnow()
        # Landsat has 16-day repeat cycle - use static date for "best" layer
        # NASA GIBS "best" layer automatically serves most recent available imagery
        date_str = "2024-01-01"  # Static date for best available imagery
        
        # NASA GIBS WMS endpoint (free, no auth required)
        base_url = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
        
        # Calculate bounding box - smaller area for higher resolution
        half_size = 0.02  # ~2km for better detail
        bbox = f"{lng-half_size},{lat-half_size},{lng+half_size},{lat+half_size}"
        
        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "VERSION": "1.3.0",
            "LAYERS": "Landsat_WELD_CorrectedReflectance_TrueColor_Global",
            "STYLES": "",
            "FORMAT": "image/png",
            "TRANSPARENT": "true",
            "WIDTH": str(width),
            "HEIGHT": str(height),
            "CRS": "EPSG:4326",
            "BBOX": bbox
            # TIME parameter removed - "best" layer serves most recent available
        }
        
        url = f"{base_url}?{requests.compat.urlencode(params)}"
        print(f"[SATELLITE] NASA GIBS URL: {base_url}?SERVICE=WMS&...")
        
        response = requests.get(url, timeout=60)
        print(f"[SATELLITE] Response status: {response.status_code}")
        print(f"[SATELLITE] Content-Type: {response.headers.get('Content-Type')}")
        
        if response.status_code == 200 and 'image' in response.headers.get('Content-Type', ''):
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] NASA image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "NASA Landsat-8 (30м)",
                "resolution": "30m per pixel",
                "date": date_str,
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": [lng-half_size, lat-half_size, lng+half_size, lat+half_size],
                "coverage": "Global (including Russia)"
            }
        else:
            print(f"[SATELLITE] NASA error {response.status_code}: {response.text[:200]}")
            # Fallback to error with instructions
            return {
                "success": False,
                "error": f"NASA GIBS error: {response.status_code}. Возможно нет данных для этой даты.",
                "fallback": True
            }
            
    except Exception as e:
        print(f"[SATELLITE] Exception: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def get_ndvi_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get NDVI image from Sentinel Hub (10m resolution) or NASA GIBS fallback
    """
    print(f"[SATELLITE] get_ndvi_image() called: lat={lat}, lng={lng}")
    
    # Try Sentinel Hub first (high resolution 10m)
    try:
        token = get_sentinel_oauth_token()
        
        url = "https://services.sentinel-hub.com/api/v1/process"
        
        # Calculate bounding box (small area for high resolution)
        half_size = 0.005  # ~500m for 10m resolution
        bbox = [lng - half_size, lat - half_size, lng + half_size, lat + half_size]
        
        today = datetime.utcnow()
        past = today - timedelta(days=30)  # Look back 30 days
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        body = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": past.isoformat() + "Z",
                            "to": today.isoformat() + "Z"
                        },
                        "maxCloudCoverage": 30
                    }
                }]
            },
            "output": {
                "width": width,
                "height": height,
                "responses": [{
                    "identifier": "default",
                    "format": {"type": "image/png"}
                }]
            },
            "evalscript": """
            // NDVI visualization with color ramp
            function setup() {
                return {
                    input: ["B04", "B08"],
                    output: { bands: 3 }
                };
            }
            
            function evaluatePixel(sample) {
                let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
                
                // Color ramp for NDVI
                if (ndvi < 0) return [0.5, 0, 0];      // Red - water/shadows
                if (ndvi < 0.2) return [0.8, 0.6, 0.4]; // Brown - bare soil
                if (ndvi < 0.4) return [0.9, 0.8, 0.2]; // Yellow - sparse
                if (ndvi < 0.6) return [0.4, 0.7, 0.4]; // Light green
                if (ndvi < 0.8) return [0.2, 0.6, 0.2]; // Green
                return [0, 0.4, 0];                      // Dark green - dense
            }
            """
        }
        
        print(f"[SATELLITE] Sending Sentinel Hub NDVI request...")
        response = requests.post(url, headers=headers, json=body, timeout=60)
        print(f"[SATELLITE] Sentinel NDVI status: {response.status_code}")
        
        if response.status_code == 200:
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] Sentinel NDVI image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 NDVI (10м)",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": bbox,
                "resolution": "10m",
                "coverage": "Global"
            }
        else:
            print(f"[SATELLITE] Sentinel error: {response.status_code} - {response.text[:200]}")
            # Fall through to NASA GIBS
            
    except Exception as e:
        print(f"[SATELLITE] Sentinel NDVI failed: {e}, using NASA fallback")
        # Fall through to NASA GIBS
    
    # NASA GIBS fallback (250m resolution)
    try:
        print(f"[SATELLITE] Trying NASA GIBS NDVI fallback...")
        today = datetime.utcnow()
        
        base_url = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
        
        half_size = 0.05
        bbox = f"{lng-half_size},{lat-half_size},{lng+half_size},{lat+half_size}"
        
        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "VERSION": "1.3.0",
            "LAYERS": "MODIS_Terra_NDVI_8Day",
            "STYLES": "",
            "FORMAT": "image/png",
            "TRANSPARENT": "true",
            "WIDTH": str(width),
            "HEIGHT": str(height),
            "CRS": "EPSG:4326",
            "BBOX": bbox
        }
        
        url = f"{base_url}?{requests.compat.urlencode(params)}"
        
        response = requests.get(url, timeout=60)
        print(f"[SATELLITE] NASA NDVI status: {response.status_code}")
        
        if response.status_code == 200 and 'image' in response.headers.get('Content-Type', ''):
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] NASA NDVI image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "NASA MODIS NDVI (250м)",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": [lng-half_size, lat-half_size, lng+half_size, lat+half_size],
                "resolution": "250m",
                "coverage": "Global (including Russia)",
                "fallback": True
            }
        else:
            return {
                "success": False,
                "error": f"NASA NDVI error: {response.status_code}",
            }
            
    except Exception as e:
        print(f"[SATELLITE] NASA NDVI Exception: {e}")
        return {
            "success": False,
            "error": str(e)
        }
