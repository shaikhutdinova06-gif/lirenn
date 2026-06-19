import os
import json
import tempfile
from datetime import timedelta

from backend.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    register_user,
    authenticate_user,
    get_users,
    save_users,
    USERS_FILE,
)


def _reset_users_file():
    """Wipe the test users file so each test starts clean."""
    if os.path.exists(USERS_FILE):
        os.remove(USERS_FILE)


class TestHashAndVerify:
    def test_hash_returns_salt_and_hash(self):
        h = hash_password("secret")
        assert "$" in h
        parts = h.split("$")
        assert len(parts) == 2

    def test_verify_correct_password(self):
        h = hash_password("mypassword")
        assert verify_password("mypassword", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("mypassword")
        assert verify_password("wrong", h) is False

    def test_verify_malformed_hash(self):
        assert verify_password("x", "nope") is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # different salts


class TestTokens:
    def test_create_and_decode_token(self):
        token = create_access_token(data={"sub": "testuser"})
        user_data = {"sub": "testuser"}
        from jose import jwt
        from backend.services.auth import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        assert "exp" in payload

    def test_custom_expiry(self):
        token = create_access_token(
            data={"sub": "u"}, expires_delta=timedelta(minutes=5)
        )
        from jose import jwt
        from backend.services.auth import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "u"

    def test_invalid_token_returns_none(self):
        result = get_current_user("invalid.token.here")
        assert result is None


class TestUserRegistration:
    def setup_method(self):
        _reset_users_file()

    def teardown_method(self):
        _reset_users_file()

    def test_register_new_user(self):
        result = register_user("alice", "pass123")
        assert "error" not in result
        assert result.get("status") == "ok"

    def test_register_duplicate(self):
        register_user("bob", "pass")
        result = register_user("bob", "pass2")
        assert "error" in result
        assert "already exists" in result["error"]


class TestAuthentication:
    def setup_method(self):
        _reset_users_file()

    def teardown_method(self):
        _reset_users_file()

    def test_authenticate_success(self):
        register_user("carol", "secret")
        user = authenticate_user("carol", "secret")
        assert user is not False
        assert user["username"] == "carol"

    def test_authenticate_wrong_password(self):
        register_user("dave", "right")
        result = authenticate_user("dave", "wrong")
        assert result is False

    def test_authenticate_nonexistent_user(self):
        result = authenticate_user("ghost", "pass")
        assert result is False


class TestGetCurrentUser:
    def setup_method(self):
        _reset_users_file()

    def teardown_method(self):
        _reset_users_file()

    def test_valid_token(self):
        register_user("eve", "pw")
        token = create_access_token(data={"sub": "eve"})
        user = get_current_user(token)
        assert user is not None
        assert user["username"] == "eve"

    def test_token_for_missing_user(self):
        token = create_access_token(data={"sub": "nobody"})
        user = get_current_user(token)
        assert user is None
