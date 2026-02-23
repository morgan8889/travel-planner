import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.base import Base, TimestampMixin, UUIDMixin


class ChatRole(enum.StrEnum):
    user = "user"
    assistant = "assistant"


class ChatThread(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chat_threads"

    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="thread", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chat_messages"

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id")
    )
    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole))
    content: Mapped[str] = mapped_column(Text)

    thread: Mapped["ChatThread"] = relationship(back_populates="messages")
