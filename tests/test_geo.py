from unittest.mock import patch, MagicMock
from backend.services.geo import detect_region, get_country


class TestDetectRegion:
    @patch("backend.services.geo.requests.get")
    def test_returns_state(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "address": {"state": "Московская область"}
        }
        mock_get.return_value = mock_resp

        result = detect_region(55.75, 37.62)
        assert result == "Московская область"

    @patch("backend.services.geo.requests.get")
    def test_falls_back_to_province(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "address": {"province": "Краснодарский край"}
        }
        mock_get.return_value = mock_resp

        result = detect_region(45.0, 39.0)
        assert result == "Краснодарский край"

    @patch("backend.services.geo.requests.get")
    def test_falls_back_to_city(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "address": {"city": "Москва"}
        }
        mock_get.return_value = mock_resp

        result = detect_region(55.75, 37.62)
        assert result == "Москва"

    @patch("backend.services.geo.requests.get")
    def test_unknown_on_empty_address(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"address": {}}
        mock_get.return_value = mock_resp

        result = detect_region(0, 0)
        assert result == "неизвестно"

    @patch("backend.services.geo.requests.get")
    def test_api_error_status(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_get.return_value = mock_resp

        result = detect_region(55.75, 37.62)
        assert result == "неизвестно"

    @patch("backend.services.geo.requests.get", side_effect=Exception("timeout"))
    def test_network_error(self, mock_get):
        result = detect_region(55.75, 37.62)
        assert result == "неизвестно"


class TestGetCountry:
    @patch("backend.services.geo.requests.get")
    def test_returns_country(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "address": {"country": "Россия"}
        }
        mock_get.return_value = mock_resp

        result = get_country(55.75, 37.62)
        assert result == "Россия"

    @patch("backend.services.geo.requests.get")
    def test_missing_country(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"address": {}}
        mock_get.return_value = mock_resp

        result = get_country(55.75, 37.62)
        assert result == "неизвестно"

    @patch("backend.services.geo.requests.get")
    def test_api_error(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        result = get_country(55.75, 37.62)
        assert result == "неизвестно"

    @patch("backend.services.geo.requests.get", side_effect=Exception("err"))
    def test_exception(self, mock_get):
        result = get_country(55.75, 37.62)
        assert result == "неизвестно"
