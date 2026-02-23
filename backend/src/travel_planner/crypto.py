"""Cryptographic utilities for storing sensitive data at rest.

Token columns use EncryptedText, a SQLAlchemy TypeDecorator that transparently
encrypts on write and decrypts on read using Fernet symmetric encryption.

The encryption key must be provided via the TOKEN_ENCRYPTION_KEY environment
variable. Generate a key with: python -c "from cryptography.fernet import
Fernet; print(Fernet.generate_key().decode())"
"""

import os

from cryptography.fernet import Fernet
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


class EncryptedText(TypeDecorator):
    """Transparent Fernet encryption for text columns.

    Values are encrypted before being sent to the database and decrypted
    after being read back. The underlying column type is TEXT; no schema
    migration is required when adopting this type on an existing column.
    """

    impl = Text
    cache_ok = True

    def _fernet(self) -> Fernet:
        key = os.environ.get("TOKEN_ENCRYPTION_KEY")
        if not key:
            raise ValueError(
                "TOKEN_ENCRYPTION_KEY environment variable is not set. "
                "Generate one with: python -c \"from cryptography.fernet import "
                "Fernet; print(Fernet.generate_key().decode())\""
            )
        return Fernet(key.encode() if isinstance(key, str) else key)

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        """Encrypt plaintext before writing to the database."""
        if value is None:
            return None
        return self._fernet().encrypt(value.encode()).decode()

    def process_result_value(self, value: str | None, dialect) -> str | None:
        """Decrypt ciphertext after reading from the database."""
        if value is None:
            return None
        return self._fernet().decrypt(value.encode()).decode()
