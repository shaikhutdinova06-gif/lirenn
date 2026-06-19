from backend.services.compare import (
    get_soil_parameters,
    compare,
    compare_with_multiple,
    find_best_match,
    find_similar,
)


class TestGetSoilParameters:
    def test_returns_dict(self):
        params = get_soil_parameters("чернозем")
        assert isinstance(params, dict)

    def test_has_expected_keys(self):
        params = get_soil_parameters("anything")
        for key in ("ph", "humus", "moisture", "nitrogen", "phosphorus", "potassium"):
            assert key in params

    def test_values_are_tuples(self):
        params = get_soil_parameters("x")
        for v in params.values():
            assert isinstance(v, tuple) and len(v) == 2


class TestCompare:
    def test_perfect_match(self):
        params = get_soil_parameters("чернозем")
        real = {k: (lo + hi) / 2 for k, (lo, hi) in params.items()}
        score = compare(real, "чернозем")
        assert score == 1.0

    def test_no_matching_params(self):
        score = compare({"unknown_param": 99}, "чернозем")
        assert score == 0.5

    def test_out_of_range_reduces_score(self):
        params = get_soil_parameters("чернозем")
        real = {k: hi + 5 for k, (_, hi) in params.items()}
        score = compare(real, "чернозем")
        assert 0 < score < 1.0

    def test_score_between_0_and_1(self):
        real = {"ph": 3.0, "humus": 20, "moisture": 99}
        score = compare(real, "чернозем")
        assert 0 <= score <= 1.0


class TestCompareWithMultiple:
    def test_returns_dict_with_all_types(self):
        types = ["type_a", "type_b"]
        result = compare_with_multiple({"ph": 6.5}, types)
        assert set(result.keys()) == set(types)


class TestFindBestMatch:
    def test_returns_tuple(self):
        best_type, score = find_best_match({"ph": 6.5}, ["a", "b"])
        assert isinstance(best_type, str)
        assert isinstance(score, float)


class TestFindSimilar:
    def test_returns_status_ok(self):
        result = find_similar({"ph": 6.5})
        assert result["status"] == "ok"
