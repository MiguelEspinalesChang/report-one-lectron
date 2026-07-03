"""CSV import pipeline: one parser per manufacturer profile.

Normalizes rows to (device_id, timestamp, metric, value, source='csv_import')
and batch-inserts with INSERT OR IGNORE for automatic deduplication.
"""
