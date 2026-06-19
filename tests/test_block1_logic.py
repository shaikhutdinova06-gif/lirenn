from backend.services.block1_logic import calculate_confidence, zc_category


class TestCalculateConfidence:
    def test_empty_data(self):
        assert calculate_confidence({}) == 0

    def test_image_only(self):
        assert calculate_confidence({"image": "base64data"}) == 40

    def test_ph_only(self):
        assert calculate_confidence({"ph": 6.5}) == 30

    def test_moisture_only(self):
        assert calculate_confidence({"moisture": 50}) == 20

    def test_coordinates_only(self):
        assert calculate_confidence({"lat": 55.75, "lng": 37.62}) == 10

    def test_all_data(self):
        data = {
            "image": "base64data",
            "ph": 6.5,
            "moisture": 50,
            "lat": 55.75,
            "lng": 37.62,
        }
        assert calculate_confidence(data) == 100

    def test_ph_none_not_counted(self):
        assert calculate_confidence({"ph": None}) == 0

    def test_moisture_none_not_counted(self):
        assert calculate_confidence({"moisture": None}) == 0

    def test_partial_coordinates(self):
        assert calculate_confidence({"lat": 55.75}) == 0
        assert calculate_confidence({"lng": 37.62}) == 0


class TestZcCategory:
    def test_none(self):
        assert zc_category(None) == "не определено"

    def test_low(self):
        assert zc_category(0) == "допустимое"
        assert zc_category(15) == "допустимое"
        assert zc_category(15.9) == "допустимое"

    def test_moderate(self):
        assert zc_category(16) == "умеренно опасное"
        assert zc_category(31) == "умеренно опасное"

    def test_dangerous(self):
        assert zc_category(32) == "опасное"
        assert zc_category(127) == "опасное"

    def test_extreme(self):
        assert zc_category(128) == "чрезвычайно опасное"
        assert zc_category(500) == "чрезвычайно опасное"
