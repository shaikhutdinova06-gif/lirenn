from backend.services.soil_reference import (
    SOIL_REFERENCE,
    get_reference,
    calculate_deviation,
    get_soil_quality_score,
    get_recommendations,
)


class TestGetReference:
    def test_exact_match(self):
        ref = get_reference("чернозем")
        assert ref is not None
        assert ref["ph"] == 6.5

    def test_case_insensitive(self):
        ref = get_reference("Чернозем")
        assert ref is not None

    def test_partial_match(self):
        ref = get_reference("дерново-подзолистая почва")
        assert ref is not None

    def test_none_input(self):
        assert get_reference(None) is None

    def test_empty_string(self):
        assert get_reference("") is None

    def test_unknown_type(self):
        assert get_reference("марсианская почва") is None

    def test_all_reference_types_exist(self):
        for soil_name in SOIL_REFERENCE:
            ref = get_reference(soil_name)
            assert ref is not None, f"Reference not found for {soil_name}"


class TestCalculateDeviation:
    def test_none_reference(self):
        assert calculate_deviation({"ph": 6.5}, None) is None

    def test_empty_current_data(self):
        ref = SOIL_REFERENCE["чернозем"]
        result = calculate_deviation({}, ref)
        assert result is None

    def test_single_param_deviation(self):
        ref = SOIL_REFERENCE["чернозем"]
        result = calculate_deviation({"ph": 7.5}, ref)
        assert "ph_diff" in result
        assert result["ph_diff"] == 1.0
        assert "ph_percent" in result

    def test_no_deviation(self):
        ref = SOIL_REFERENCE["чернозем"]
        result = calculate_deviation({"ph": 6.5}, ref)
        assert result["ph_diff"] == 0.0
        assert result["ph_percent"] == 0.0

    def test_negative_deviation(self):
        ref = SOIL_REFERENCE["чернозем"]
        result = calculate_deviation({"ph": 5.5}, ref)
        assert result["ph_diff"] == -1.0
        assert result["ph_percent"] < 0

    def test_multiple_params(self):
        ref = SOIL_REFERENCE["чернозем"]
        data = {"ph": 7.0, "humus": 5.0, "nitrogen": 0.4}
        result = calculate_deviation(data, ref)
        assert "ph_diff" in result
        assert "humus_diff" in result
        assert "nitrogen_diff" in result

    def test_none_value_skipped(self):
        ref = SOIL_REFERENCE["чернозем"]
        result = calculate_deviation({"ph": None, "humus": 5.0}, ref)
        assert "ph_diff" not in result
        assert "humus_diff" in result


class TestGetSoilQualityScore:
    def test_none_deviation(self):
        assert get_soil_quality_score(None) == 50

    def test_empty_deviation(self):
        assert get_soil_quality_score({}) == 50

    def test_zero_deviation(self):
        deviation = {"ph_percent": 0.0, "humus_percent": 0.0}
        score = get_soil_quality_score(deviation)
        assert score == 100

    def test_large_deviation_reduces_score(self):
        deviation = {"ph_percent": 50.0, "humus_percent": 50.0}
        score = get_soil_quality_score(deviation)
        assert score < 100

    def test_score_clamped_to_0_100(self):
        deviation = {"ph_percent": 200.0}
        score = get_soil_quality_score(deviation)
        assert 0 <= score <= 100

    def test_non_percent_keys_ignored(self):
        deviation = {"ph_diff": 5.0}
        score = get_soil_quality_score(deviation)
        assert score == 50  # no _percent keys → default


class TestGetRecommendations:
    def test_none_deviation(self):
        recs = get_recommendations(None, "чернозем")
        assert len(recs) == 1
        assert "Недостаточно данных" in recs[0]

    def test_low_ph(self):
        deviation = {"ph_percent": -15}
        recs = get_recommendations(deviation, "чернозем")
        assert any("известкование" in r for r in recs)

    def test_high_ph(self):
        deviation = {"ph_percent": 15}
        recs = get_recommendations(deviation, "чернозем")
        assert any("серы" in r for r in recs)

    def test_low_humus(self):
        deviation = {"humus_percent": -25}
        recs = get_recommendations(deviation, "чернозем")
        assert any("органических" in r for r in recs)

    def test_high_humus(self):
        deviation = {"humus_percent": 25}
        recs = get_recommendations(deviation, "чернозем")
        assert any("гумуса" in r.lower() for r in recs)

    def test_nitrogen_deficit(self):
        deviation = {"nitrogen_percent": -35}
        recs = get_recommendations(deviation, "чернозем")
        assert any("азот" in r.lower() for r in recs)

    def test_phosphorus_deficit(self):
        deviation = {"phosphorus_percent": -35}
        recs = get_recommendations(deviation, "чернозем")
        assert any("фосфор" in r.lower() for r in recs)

    def test_potassium_deficit(self):
        deviation = {"potassium_percent": -35}
        recs = get_recommendations(deviation, "чернозем")
        assert any("калий" in r.lower() for r in recs)

    def test_all_normal(self):
        deviation = {"ph_percent": 0, "humus_percent": 0}
        recs = get_recommendations(deviation, "чернозем")
        assert any("в пределах нормы" in r for r in recs)
