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
    Get satellite image using WMS with Instance ID
    """
    print(f"[SATELLITE] get_satellite_image() called: lat={lat}, lng={lng}")
    
    try:
        today = datetime.utcnow()
        
        # WMS endpoint with Instance ID in URL
        base_url = f"https://services.sentinel-hub.com/ogc/wms/{INSTANCE_ID}"
        
        # Calculate bounding box
        half_size = 0.01
        bbox = f"{lng-half_size},{lat-half_size},{lng+half_size},{lat+half_size}"
        
        params = {
            "SERVICE": "WMS",
            "REQUEST": "GetMap",
            "VERSION": "1.3.0",
            "LAYERS": "TRUE_COLOR",
            "MAXCC": "20",
            "WIDTH": str(width),
            "HEIGHT": str(height),
            "CRS": "EPSG:4326",
            "BBOX": bbox,
            "FORMAT": "image/png",
            "TIME": f"{(today - timedelta(days=30)).strftime('%Y-%m-%d')}/{today.strftime('%Y-%m-%d')}"
        }
        
        url = f"{base_url}?{requests.compat.urlencode(params)}"
        print(f"[SATELLITE] WMS URL: {base_url}?SERVICE=WMS&...")
        
        response = requests.get(url, timeout=60)
        print(f"[SATELLITE] Response status: {response.status_code}")
        print(f"[SATELLITE] Content-Type: {response.headers.get('Content-Type')}")
        
        if response.status_code == 200 and 'image' in response.headers.get('Content-Type', ''):
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] Image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 WMS",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": [lng-half_size, lat-half_size, lng+half_size, lat+half_size]
            }
        elif response.status_code == 401:
            print(f"[SATELLITE] ERROR 401: Instance ID invalid")
            return {
                "success": False,
                "error": "Instance ID authentication failed. Check SENTINEL_INSTANCE_ID",
                "status_code": 401
            }
        else:
            print(f"[SATELLITE] ERROR {response.status_code}: {response.text[:200]}")
            return {
                "success": False,
                "error": f"WMS error: {response.status_code}",
                "status_code": response.status_code
            }
            
    except Exception as e:
        print(f"[SATELLITE] Exception: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def get_ndvi_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get NDVI image for vegetation analysis
    """
    print(f"[SATELLITE] get_ndvi_image() called: lat={lat}, lng={lng}")
    
    try:
        headers = get_auth_headers()
        today = datetime.utcnow()
        past = today - timedelta(days=7)
        
        url = "https://services.sentinel-hub.com/api/v1/process"
        bbox = [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01]
        
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
                        "maxCloudCoverage": 20
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
            let ndvi = (B08 - B04) / (B08 + B04);
            if (ndvi < 0) return [0.5, 0, 0];
            else if (ndvi < 0.2) return [1, 0.5, 0];
            else if (ndvi < 0.4) return [1, 0.8, 0];
            else if (ndvi < 0.6) return [0.4, 0.8, 0.4];
            else return [0, 0.4, 0];
            """
        }
        
        response = requests.post(url, headers=headers, json=body, timeout=60)
        
        if response.status_code == 200:
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 NDVI",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": bbox
            }
        else:
            return {
                "success": False,
                "error": f"API error: {response.status_code}",
                "status_code": response.status_code
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
