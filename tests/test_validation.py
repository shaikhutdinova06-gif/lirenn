from backend.services.validation import validate_input


class TestValidateInput:
    def test_missing_user_id(self):
        errors = validate_input({})
        assert "user_id обязателен" in errors

    def test_valid_minimal(self):
        errors = validate_input({"user_id": "u1"})
        assert errors == []

    def test_ph_valid_boundary_low(self):
        errors = validate_input({"user_id": "u1", "ph": 0})
        assert errors == []

    def test_ph_valid_boundary_high(self):
        errors = validate_input({"user_id": "u1", "ph": 14})
        assert errors == []

    def test_ph_out_of_range_negative(self):
        errors = validate_input({"user_id": "u1", "ph": -1})
        assert "pH вне диапазона" in errors

    def test_ph_out_of_range_above(self):
        errors = validate_input({"user_id": "u1", "ph": 15})
        assert "pH вне диапазона" in errors

    def test_ph_not_a_number(self):
        errors = validate_input({"user_id": "u1", "ph": "abc"})
        assert "pH должен быть числом" in errors

    def test_moisture_valid(self):
        errors = validate_input({"user_id": "u1", "moisture": 50})
        assert errors == []

    def test_moisture_out_of_range_negative(self):
        errors = validate_input({"user_id": "u1", "moisture": -5})
        assert "влажность вне диапазона" in errors

    def test_moisture_out_of_range_above(self):
        errors = validate_input({"user_id": "u1", "moisture": 101})
        assert "влажность вне диапазона" in errors

    def test_moisture_not_a_number(self):
        errors = validate_input({"user_id": "u1", "moisture": "wet"})
        assert "влажность должна быть числом" in errors

    def test_lat_valid(self):
        errors = validate_input({"user_id": "u1", "lat": 55.75})
        assert errors == []

    def test_lat_invalid(self):
        errors = validate_input({"user_id": "u1", "lat": 91})
        assert "неверная широта" in errors

    def test_lat_invalid_negative(self):
        errors = validate_input({"user_id": "u1", "lat": -91})
        assert "неверная широта" in errors

    def test_lng_valid(self):
        errors = validate_input({"user_id": "u1", "lng": 37.62})
        assert errors == []

    def test_lng_invalid(self):
        errors = validate_input({"user_id": "u1", "lng": 181})
        assert "неверная долгота" in errors

    def test_lng_invalid_negative(self):
        errors = validate_input({"user_id": "u1", "lng": -181})
        assert "неверная долгота" in errors

    def test_multiple_errors(self):
        errors = validate_input({"ph": -1, "moisture": 200})
        assert len(errors) >= 3  # user_id + ph + moisture

    def test_none_ph_ignored(self):
        errors = validate_input({"user_id": "u1", "ph": None})
        assert errors == []

    def test_none_moisture_ignored(self):
        errors = validate_input({"user_id": "u1", "moisture": None})
        assert errors == []
