"""
Satellite imagery service using Sentinel Hub API
Provides real satellite images from Sentinel-2
"""
import requests
import os
from datetime import datetime, timedelta
import base64
from typing import Dict, Any

# Load credentials from environment
CLIENT_ID = os.getenv("SENTINEL_CLIENT_ID")
CLIENT_SECRET = os.getenv("SENTINEL_CLIENT_SECRET")

def get_access_token() -> str:
    """
    Get OAuth access token from Sentinel Hub
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError("SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET must be set in environment")
    
    url = "https://services.sentinel-hub.com/oauth/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }
    
    try:
        res = requests.post(url, data=data, timeout=30)
        res.raise_for_status()
        return res.json()["access_token"]
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"Failed to get Sentinel Hub token: {str(e)}")
    except KeyError:
        raise ValueError("Invalid response from Sentinel Hub auth service")

def get_satellite_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get satellite image for given coordinates from Sentinel-2
    
    Args:
        lat: Latitude
        lng: Longitude
        width: Image width in pixels
        height: Image height in pixels
    
    Returns:
        Dictionary with base64 image, source info, and date
    """
    try:
        token = get_access_token()
        
        # Last 7 days for fresh imagery
        today = datetime.utcnow()
        past = today - timedelta(days=7)
        
        url = "https://services.sentinel-hub.com/api/v1/process"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Bounding box around coordinates (roughly 1km x 1km)
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
                        "maxCloudCoverage": 20  # Max 20% cloud coverage
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
            // RGB natural colors
            let gain = 2.5;
            return [B04 * gain, B03 * gain, B02 * gain];
            """
        }
        
        response = requests.post(url, headers=headers, json=body, timeout=60)
        
        if response.status_code == 200:
            # Encode image to base64
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 L2A",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": bbox
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "error": "Authentication failed - check Sentinel Hub credentials",
                "status_code": 401
            }
        elif response.status_code == 400:
            error_detail = response.text[:200] if response.text else "Bad request"
            return {
                "success": False,
                "error": f"Bad request: {error_detail}",
                "status_code": 400
            }
        else:
            return {
                "success": False,
                "error": f"Satellite API error: {response.status_code}",
                "status_code": response.status_code,
                "details": response.text[:300] if response.text else None
            }
            
    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
            "type": "configuration_error"
        }
    except ConnectionError as e:
        return {
            "success": False,
            "error": str(e),
            "type": "connection_error"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "type": "unknown_error"
        }

def get_ndvi_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get NDVI (Normalized Difference Vegetation Index) image
    Useful for vegetation health analysis
    """
    try:
        token = get_access_token()
        
        today = datetime.utcnow()
        past = today - timedelta(days=7)
        
        url = "https://services.sentinel-hub.com/api/v1/process"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        bbox = [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01]
        
        # NDVI visualization evalscript
        evalscript = """
        // NDVI - Normalized Difference Vegetation Index
        let ndvi = (B08 - B04) / (B08 + B04);
        
        // Color scale for NDVI
        // < 0.2 - barren/urban (red)
        // 0.2-0.4 - sparse vegetation (orange)
        // 0.4-0.6 - moderate vegetation (yellow)
        // 0.6-0.8 - healthy vegetation (light green)
        // > 0.8 - very healthy vegetation (dark green)
        
        if (ndvi < 0.2) return [0.8, 0.2, 0.2];
        else if (ndvi < 0.4) return [0.9, 0.6, 0.2];
        else if (ndvi < 0.6) return [0.9, 0.9, 0.2];
        else if (ndvi < 0.8) return [0.4, 0.8, 0.4];
        else return [0.1, 0.5, 0.1];
        """
        
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
            "evalscript": evalscript
        }
        
        response = requests.post(url, headers=headers, json=body, timeout=60)
        
        if response.status_code == 200:
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 L2A (NDVI)",
                "date": today.strftime("%Y-%m-%d"),
                "type": "ndvi",
                "description": "NDVI vegetation health index - red: barren, green: healthy vegetation",
                "coordinates": {"lat": lat, "lng": lng}
            }
        else:
            return {
                "success": False,
                "error": f"NDVI API error: {response.status_code}",
                "details": response.text[:300] if response.text else None
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
