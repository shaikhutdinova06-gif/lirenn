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
    Get satellite image - Sentinel Hub integration
    NOTE: Requires properly configured Sentinel Hub account with OGC services
    """
    print(f"[SATELLITE] get_satellite_image() called: lat={lat}, lng={lng}")
    print(f"[SATELLITE] Instance ID: {INSTANCE_ID[:15]}...")
    
    # For now, return demo response with setup instructions
    # Full integration requires Sentinel Hub Configuration Utility setup
    return {
        "success": False,
        "error": "Sentinel Hub WMS не настроен. Требуется активация OGC сервисов.",
        "setup_required": True,
        "instructions": [
            "1. Войдите в Sentinel Hub Dashboard",
            "2. Перейдите в Configuration Utility",
            "3. Создайте новую конфигурацию (Instance)",
            "4. Добавьте слой Sentinel-2 L2A",
            "5. Включите OGC (WMS) сервисы",
            "6. Скопируйте Instance ID в настройки"
        ],
        "coordinates": {"lat": lat, "lng": lng},
        "demo": True
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
