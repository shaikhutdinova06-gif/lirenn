from backend.services.soil_types_russia import SOIL_TYPES_RUSSIA


class TestSoilTypesRussia:
    def test_not_empty(self):
        assert len(SOIL_TYPES_RUSSIA) > 0

    def test_all_keys_are_strings(self):
        for key in SOIL_TYPES_RUSSIA:
            assert isinstance(key, str), f"Key {key!r} is not a string"

    def test_all_values_are_strings(self):
        for key, value in SOIL_TYPES_RUSSIA.items():
            assert isinstance(value, str), f"Value for {key!r} is not a string"

    def test_no_empty_values(self):
        for key, value in SOIL_TYPES_RUSSIA.items():
            assert value.strip(), f"Empty value for key {key!r}"

    def test_known_codes_exist(self):
        assert "Чт" in SOIL_TYPES_RUSSIA  # Черноземы типичные
        assert "П" in SOIL_TYPES_RUSSIA   # Подзолистые

    def test_chernozem_types_present(self):
        chernozem_codes = [k for k, v in SOIL_TYPES_RUSSIA.items() if "Чернозем" in v]
        assert len(chernozem_codes) > 0

    def test_unique_values_mostly(self):
        values = list(SOIL_TYPES_RUSSIA.values())
        # Allow some duplicates but the majority should be unique
        unique_ratio = len(set(values)) / len(values)
        assert unique_ratio > 0.8
