import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from travel_planner.models.base import Base, TimestampMixin, UUIDMixin


class Checklist(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "checklists"
    __table_args__ = (Index("ix_checklists_trip_id", "trip_id"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(255))

    items: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="checklist", order_by="ChecklistItem.sort_order"
    )


class ChecklistItem(Base, UUIDMixin):
    __tablename__ = "checklist_items"

    checklist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklists.id", ondelete="CASCADE")
    )
    text: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    checklist: Mapped["Checklist"] = relationship(back_populates="items")
    user_checks: Mapped[list["ChecklistItemUser"]] = relationship(back_populates="item")


class ChecklistItemUser(Base, UUIDMixin):
    __tablename__ = "checklist_item_users"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklist_items.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="CASCADE")
    )
    checked: Mapped[bool] = mapped_column(Boolean, default=False)

    item: Mapped["ChecklistItem"] = relationship(back_populates="user_checks")

    __table_args__ = (
        UniqueConstraint("item_id", "user_id", name="uq_checklist_item_user"),
    )
