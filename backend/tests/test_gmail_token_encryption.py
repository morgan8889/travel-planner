"""Tests for Gmail OAuth token encryption at rest."""

import os

import pytest

from travel_planner.crypto import EncryptedText
from travel_planner.models.gmail import GmailConnection

# ---------------------------------------------------------------------------
# EncryptedText TypeDecorator behaviour
# ---------------------------------------------------------------------------


def test_bind_param_does_not_store_plaintext():
    """process_bind_param must return ciphertext, not the original value."""
    enc = EncryptedText()
    plaintext = "ya29.access_token_value"
    result = enc.process_bind_param(plaintext, dialect=None)
    assert result is not None
    assert result != plaintext
    assert plaintext not in result


def test_result_value_decrypts_back_to_original():
    """process_result_value must return the original plaintext."""
    enc = EncryptedText()
    plaintext = "1//refresh_token_value"
    ciphertext = enc.process_bind_param(plaintext, dialect=None)
    assert enc.process_result_value(ciphertext, dialect=None) == plaintext


def test_encryption_is_non_deterministic():
    """Fernet uses a random IV, so encrypting the same value twice
    yields different ciphertext."""
    enc = EncryptedText()
    plaintext = "same_token"
    assert enc.process_bind_param(plaintext, dialect=None) != enc.process_bind_param(
        plaintext, dialect=None
    )


def test_none_passes_through_unchanged():
    """None (nullable column) must pass through without attempting encryption."""
    enc = EncryptedText()
    assert enc.process_bind_param(None, dialect=None) is None
    assert enc.process_result_value(None, dialect=None) is None


def test_missing_key_raises_on_encrypt():
    """A missing TOKEN_ENCRYPTION_KEY must raise ValueError, not
    silently store plaintext."""
    saved = os.environ.pop("TOKEN_ENCRYPTION_KEY")
    try:
        enc = EncryptedText()
        with pytest.raises(ValueError, match="TOKEN_ENCRYPTION_KEY"):
            enc.process_bind_param("token", dialect=None)
    finally:
        os.environ["TOKEN_ENCRYPTION_KEY"] = saved


def test_missing_key_raises_on_decrypt():
    """A missing TOKEN_ENCRYPTION_KEY must also raise on decrypt."""
    enc = EncryptedText()
    ciphertext = enc.process_bind_param("token", dialect=None)

    saved = os.environ.pop("TOKEN_ENCRYPTION_KEY")
    try:
        with pytest.raises(ValueError, match="TOKEN_ENCRYPTION_KEY"):
            enc.process_result_value(ciphertext, dialect=None)
    finally:
        os.environ["TOKEN_ENCRYPTION_KEY"] = saved


# ---------------------------------------------------------------------------
# GmailConnection model uses EncryptedText for token columns
# ---------------------------------------------------------------------------


def test_gmail_connection_access_token_is_encrypted():
    """GmailConnection.access_token column type must be EncryptedText."""
    col_type = GmailConnection.__table__.c.access_token.type
    assert isinstance(col_type, EncryptedText)


def test_gmail_connection_refresh_token_is_encrypted():
    """GmailConnection.refresh_token column type must be EncryptedText."""
    col_type = GmailConnection.__table__.c.refresh_token.type
    assert isinstance(col_type, EncryptedText)
