from fastapi import APIRouter
from backend.services.soil_health import soil_health
from backend.services.compare import get_soil_parameters

router = APIRouter()

def calculate_health_from_parameters(soil_type, real_data):
    """Заглушка для calculate_health_from_parameters (soil_model удалён)"""
    # Используем soil_health как заглушку
    return soil_health(soil_type, real_data.get("ph", 6.5))

@router.post("/calc")
def calc(data: dict):
    """
    Научный калькулятор здоровья почвы
    
    data: dict с параметрами (ph, humus, moisture, nitrogen, phosphorus, potassium, soil_type)
    """
    soil_type = data.get("soil_type", "chernozem")
    
    # Формируем данные для расчёта
    real_data = {
        "ph": data.get("ph", 6.5),
        "humus": data.get("humus", data.get("organic", 5)),
        "moisture": data.get("moist", data.get("moisture", 50)),
        "nitrogen": data.get("nitrogen"),
        "phosphorus": data.get("phosphorus"),
        "potassium": data.get("potassium")
    }
    
    # Удаляем None значения
    real_data = {k: v for k, v in real_data.items() if v is not None}
    
    # Рассчитываем здоровье
    health = calculate_health_from_parameters(soil_type, real_data)
    
    # Получаем нормальные параметры для сравнения
    normal_params = get_soil_parameters(soil_type)
    
    return {
        "health": round(health, 2),
        "soil_type": soil_type,
        "normal_parameters": normal_params,
        "your_parameters": real_data
    }
