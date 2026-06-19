from backend.services.soil_metrics import calculate_zc


class TestCalculateZc:
    def test_empty_list(self):
        assert calculate_zc([]) == 0

    def test_none_input(self):
        assert calculate_zc(None) == 0

    def test_single_pollutant(self):
        # Zc = (10/2) - (1-1) = 5
        result = calculate_zc([{"value": 10, "background": 2}])
        assert result == 5.0

    def test_two_pollutants(self):
        # Zc = (10/2 + 6/3) - (2-1) = 5 + 2 - 1 = 6
        result = calculate_zc([
            {"value": 10, "background": 2},
            {"value": 6, "background": 3},
        ])
        assert result == 6.0

    def test_background_zero_defaults_to_one(self):
        # background=0 → treated as 1 → Zc = (5/1) - 0 = 5
        result = calculate_zc([{"value": 5, "background": 0}])
        assert result == 5.0

    def test_background_none_defaults_to_one(self):
        result = calculate_zc([{"value": 5, "background": None}])
        assert result == 5.0

    def test_value_none_defaults_to_zero(self):
        result = calculate_zc([{"value": None, "background": 2}])
        assert result == 0.0

    def test_missing_keys_use_defaults(self):
        # value defaults to 0, background defaults to 1
        # Zc = (0/1) - 0 = 0
        result = calculate_zc([{}])
        assert result == 0.0

    def test_three_pollutants(self):
        # Zc = (4/1 + 6/2 + 9/3) - (3-1) = 4+3+3 - 2 = 8
        result = calculate_zc([
            {"value": 4, "background": 1},
            {"value": 6, "background": 2},
            {"value": 9, "background": 3},
        ])
        assert result == 8.0

    def test_all_at_background(self):
        # Each ci/cbi = 1, so Zc = n*1 - (n-1) = 1
        pollutants = [{"value": 5, "background": 5} for _ in range(5)]
        result = calculate_zc(pollutants)
        assert result == 1.0
