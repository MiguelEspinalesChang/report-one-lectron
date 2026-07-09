"""Pydantic mirror of the register map JSON contract (docs/features/db-architecture.md §3.4).

This model validates a register map the moment it arrives over RPC — before
any polling or storage work starts. Invalid maps raise ValidationError, which
the RPC dispatcher maps to INVALID_PARAMS.

The zod schema in packages/shared-types is the authoritative definition.
This file mirrors the same rules so Python fails fast at the same boundary.

Placement rationale: acquisition/profiles/ is where the scheduler and
transports will consume register maps to drive Modbus reads. Putting the
validation model here means the adapter that later loads a profile from an
RPC call can import and validate in one step, without reaching across package
boundaries into storage or rpc.
"""

from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator


# ── Allowed literals, mirroring the zod union types ──────────────────────────

DataType = Literal["int16", "uint16", "int32", "uint32", "int64", "float32", "float64"]
FunctionCode = Literal["holding", "input"]
WordOrder = Literal["big_endian", "little_endian"]


# ── Per-register definition ───────────────────────────────────────────────────


class RegisterEntry(BaseModel):
    """One Modbus register definition inside a map.

    Accepts both snake_case (Python-internal) and camelCase (JSON wire format)
    for ``word_order`` / ``wordOrder`` via AliasChoices.
    """

    address: int = Field(ge=0, le=65535)  # Modbus 16-bit register address space
    function: FunctionCode
    metric: str  # canonical name → readings.metric in telemetry.db
    datatype: DataType
    word_order: WordOrder = Field(
        default="big_endian",
        validation_alias=AliasChoices("word_order", "wordOrder"),
    )
    scale: float = 1.0
    unit: str = ""

    model_config = {"populate_by_name": True}


# ── Top-level register map ────────────────────────────────────────────────────


class RegisterMap(BaseModel):
    """Validated register map for a device model.

    Rules (same as the zod schema):
    - version must be exactly 1 (mirrors zod's z.literal(1)).
    - registers must be non-empty.
    - metric names must be unique within the map.
    """

    version: Literal[1]
    registers: list[RegisterEntry]

    @field_validator("registers")
    @classmethod
    def registers_must_not_be_empty(cls, v: list[RegisterEntry]) -> list[RegisterEntry]:
        if not v:
            raise ValueError("registers must contain at least one entry")
        return v

    @model_validator(mode="after")
    def metrics_must_be_unique(self) -> RegisterMap:
        metrics = [r.metric for r in self.registers]
        seen: set[str] = set()
        duplicates: list[str] = []
        for m in metrics:
            if m in seen:
                duplicates.append(m)
            seen.add(m)
        if duplicates:
            raise ValueError(f"duplicate metric names in register map: {duplicates}")
        return self
