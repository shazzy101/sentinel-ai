"""
Sentinel AI — Database models
SQLAlchemy declarative models mirroring the Supabase schema.
Used for type documentation and future direct Postgres access.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    address: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    chain: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    score: Mapped[int] = mapped_column(Integer, default=0)
    score_breakdown: Mapped[Optional[dict]] = mapped_column(JSONB)
    balance: Mapped[Optional[float]] = mapped_column(Numeric)
    last_scanned: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="wallet")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="wallet")

    __table_args__ = (
        CheckConstraint("chain IN ('ethereum')", name="wallets_chain_check"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    wallet_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("wallets.id"))
    hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    chain: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    value: Mapped[Optional[float]] = mapped_column(Numeric)
    value_symbol: Mapped[Optional[str]] = mapped_column(Text)
    direction: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    wallet: Mapped[Optional["Wallet"]] = relationship(back_populates="transactions")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    wallet_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("wallets.id"))
    signal: Mapped[Optional[str]] = mapped_column(String(20))
    signal_reason: Mapped[Optional[str]] = mapped_column(Text)
    activity_summary: Mapped[Optional[str]] = mapped_column(Text)
    key_insight: Mapped[Optional[str]] = mapped_column(Text)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    wallet: Mapped[Optional["Wallet"]] = relationship(back_populates="analyses")
