"""Polling scheduler: base mode (15 min full read) + live mode per device.

One priority queue per bus: devices on different buses poll in parallel,
devices on the same bus are serialized. Live readings never touch the DB.
"""
