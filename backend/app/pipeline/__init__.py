"""Entity-aware NLP ingestion pipeline and three-axis relationship scoring.

Modules
-------
fetch        - Python news fetchers (Google News RSS + publisher RSS + APIs).
clean        - text normalization used before NER and embedding.
ner          - spaCy NER + EntityRuler with custom finance labels.
embeddings   - pluggable embedders (OpenAI + deterministic local fallback).
scoring      - pure three-axis scoring functions + pluggable causal classifier.
schema_map   - adapters from pipeline outputs to Postgres / Qdrant / Neo4j /
               the frontend GraphData contract.
orchestrator - end-to-end ``run(articles)`` wiring everything together.
"""
