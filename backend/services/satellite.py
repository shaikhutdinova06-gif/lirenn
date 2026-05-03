"""
Satellite imagery service using Sentinel Hub API
Provides real satellite images from Sentinel-2
Uses OAuth 2.0 authentication
"""
import requests
import os
from datetime import datetime, timedelta
import base64
from typing import Dict, Any

# Load OAuth credentials from environment
CLIENT_ID = os.getenv("SENTINEL_CLIENT_ID", "TcXdcr0FAOkbwGfFC1PNgeRNJUX4H1T6")
CLIENT_SECRET = os.getenv("SENTINEL_CLIENT_SECRET", "a9ae8169-9c86-4bc9-a64b-ad907736c1f9")

def get_access_token() -> str:
    """
    Get OAuth access token from Sentinel Hub
    """
    print(f"[SATELLITE] Getting OAuth token...")
    print(f"[SATELLITE] CLIENT_ID length: {len(CLIENT_ID)}")
    print(f"[SATELLITE] CLIENT_ID: {CLIENT_ID}")
    print(f"[SATELLITE] CLIENT_SECRET length: {len(CLIENT_SECRET)}")
    
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError("SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET must be set")
    
    url = "https://services.sentinel-hub.com/oauth/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }
    
    print(f"[SATELLITE] Sending OAuth request to: {url}")
    print(f"[SATELLITE] Request data: { {'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': '***'} }")
    
    try:
        res = requests.post(url, data=data, timeout=30)
        print(f"[SATELLITE] OAuth response status: {res.status_code}")
        print(f"[SATELLITE] OAuth response text: {res.text[:200]}")
        res.raise_for_status()
        token = res.json()["access_token"]
        print(f"[SATELLITE] OAuth token obtained: {token[:20]}...")
        return token
    except requests.exceptions.RequestException as e:
        print(f"[SATELLITE] OAuth error: {e}")
        raise ConnectionError(f"Failed to get Sentinel Hub token: {str(e)}")
    except KeyError as e:
        print(f"[SATELLITE] JSON parse error: {e}")
        raise ValueError("Invalid response from Sentinel Hub auth service")

def get_auth_headers() -> dict:
    """
    Get authentication headers for Sentinel Hub
    """
    token = get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def get_satellite_image(lat: float, lng: float, width: int = 512, height: int = 512) -> Dict[str, Any]:
    """
    Get satellite image for given coordinates from Sentinel-2
    """
    print(f"[SATELLITE] get_satellite_image() called: lat={lat}, lng={lng}")
    
    try:
        headers = get_auth_headers()
        print(f"[SATELLITE] Auth headers obtained")
        
        today = datetime.utcnow()
        past = today - timedelta(days=7)
        
        url = "https://services.sentinel-hub.com/api/v1/process"
        print(f"[SATELLITE] Requesting from: {url}")
        
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
            let gain = 2.5;
            return [B04 * gain, B03 * gain, B02 * gain];
            """
        }
        
        print(f"[SATELLITE] Sending request...")
        response = requests.post(url, headers=headers, json=body, timeout=60)
        
        print(f"[SATELLITE] Response status: {response.status_code}")
        
        if response.status_code == 200:
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            print(f"[SATELLITE] Image received: {len(image_base64)} chars")
            return {
                "success": True,
                "image": f"data:image/png;base64,{image_base64}",
                "source": "Sentinel-2 L2A",
                "date": today.strftime("%Y-%m-%d"),
                "coordinates": {"lat": lat, "lng": lng},
                "bbox": bbox
            }
        elif response.status_code == 401:
            print(f"[SATELLITE] ERROR 401: {response.text[:200]}")
            return {
                "success": False,
                "error": "OAuth authentication failed - check CLIENT_ID and CLIENT_SECRET",
                "status_code": 401
            }
        else:
            print(f"[SATELLITE] ERROR {response.status_code}: {response.text[:200]}")
            return {
                "success": False,
                "error": f"API error: {response.status_code}",
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
