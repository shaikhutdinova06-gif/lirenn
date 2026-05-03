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
        # Using MODIS Terra True Color imagery (daily, global coverage)
        
        today = datetime.utcnow()
        date_str = today.strftime("%Y-%m-%d")
        
        # NASA GIBS WMS endpoint (free, no auth required)
        base_url = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
        
        # Calculate bounding box
        half_size = 0.05  # ~5km
        bbox = f"{lng-half_size},{lat-half_size},{lng+half_size},{lat+half_size}"
        
        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "VERSION": "1.3.0",
            "LAYERS": "MODIS_Terra_CorrectedReflectance_TrueColor",
            "STYLES": "",
            "FORMAT": "image/png",
            "TRANSPARENT": "true",
            "WIDTH": str(width),
            "HEIGHT": str(height),
            "CRS": "EPSG:4326",
            "BBOX": bbox,
            "TIME": date_str
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
                "source": "NASA MODIS Terra",
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
    Get NDVI image from NASA GIBS (MODIS vegetation index)
    """
    print(f"[SATELLITE] get_ndvi_image() called: lat={lat}, lng={lng}")
    
    try:
        today = datetime.utcnow()
        date_str = today.strftime("%Y-%m-%d")
        
        # NASA GIBS NDVI layer
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
            "BBOX": bbox,
            "TIME": date_str
        }
        
        url = f"{base_url}?{requests.compat.urlencode(params)}"
        print(f"[SATELLITE] NASA NDVI URL: {base_url}?SERVICE=WMS&...")
        
        response = requests.get(url, timeout=60)
        print(f"[SATELLITE] NDVI Response status: {response.status_code}")
        
        if response.status_code == 200 and 'image' in response.headers.get('Content-Type', ''):
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] NASA NDVI image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "NASA MODIS NDVI",
                "date": date_str,
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": [lng-half_size, lat-half_size, lng+half_size, lat+half_size],
                "coverage": "Global (including Russia)"
            }
        else:
            print(f"[SATELLITE] NASA NDVI error {response.status_code}")
            return {
                "success": False,
                "error": f"NASA NDVI error: {response.status_code}",
                "fallback": True
            }
            
    except Exception as e:
        print(f"[SATELLITE] NDVI Exception: {e}")
        return {
            "success": False,
            "error": str(e)
        }
