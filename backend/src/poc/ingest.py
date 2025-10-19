#!/usr/bin/env python3
"""
EchoLink Knowledge Ingestion Script
Offline tool to process creator knowledge into optimized MeTTa knowledge graphs
"""

import os
import sys
import json
import argparse
import logging
import re
from pathlib import Path
from typing import List, Dict, Any

# Core dependencies
from hyperon import MeTTa
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Dynamic Semantic Search (No Predefined Templates)
# ============================================================================
# We use fact embeddings and semantic similarity matching like in metta_reasoning.py

# ============================================================================
# REBEL Model Integration
# ============================================================================

class REBELTripleExtractor:
    """Extract structured triples using REBEL model"""
    
    def __init__(self):
        logger.info("Loading REBEL model...")
        self.tokenizer = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
        self.model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")
        logger.info("✅ REBEL model loaded")
    
    def extract_triplets_from_text(self, text: str) -> List[Dict[str, str]]:
        """
        Parse REBEL output and extract triplets using the official parsing logic.
        
        REBEL format: <triplet> subject <subj> object <obj> relation <triplet> ...
        
        Returns list of dicts with 'head', 'type', 'tail' keys
        """
        triplets = []
        relation, subject, relation, object_ = '', '', '', ''
        text = text.strip()
        current = 'x'
        
        for token in text.replace("<s>", "").replace("<pad>", "").replace("</s>", "").split():
            if token == "<triplet>":
                current = 't'
                if relation != '':
                    triplets.append({
                        'head': subject.strip(), 
                        'type': relation.strip(),
                        'tail': object_.strip()
                    })
                    relation = ''
                subject = ''
            elif token == "<subj>":
                current = 's'
                if relation != '':
                    triplets.append({
                        'head': subject.strip(), 
                        'type': relation.strip(),
                        'tail': object_.strip()
                    })
                object_ = ''
            elif token == "<obj>":
                current = 'o'
                relation = ''
            else:
                if current == 't':
                    subject += ' ' + token
                elif current == 's':
                    object_ += ' ' + token
                elif current == 'o':
                    relation += ' ' + token
        
        if subject != '' and relation != '' and object_ != '':
            triplets.append({
                'head': subject.strip(), 
                'type': relation.strip(),
                'tail': object_.strip()
            })
        
        return triplets
    
    def chunk_text(self, text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks for processing"""
        import re
        chunks = []
        sentences = re.split(r'[.!?]+', text)
        
        current_chunk = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
                chunks.append(current_chunk)
                words = current_chunk.split()
                overlap_text = ' '.join(words[-overlap:]) if len(words) > overlap else current_chunk
                current_chunk = overlap_text + ' ' + sentence
            else:
                current_chunk += ' ' + sentence if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    def extract_triples_from_text(self, text: str, max_chunks: int = 50) -> List[Dict[str, str]]:
        """Extract ALL possible triples from text using REBEL model (exact copy from metta_reasoning.py)"""
        logger.info(f"Extracting triples from {len(text)} characters...")
        all_triples = []
        
        try:
            # Split text into manageable chunks
            logger.info(f"Chunking text ({len(text)} chars)...")
            chunks = self.chunk_text(text, chunk_size=400, overlap=50)
            logger.info(f"Created {len(chunks)} chunks")
            
            # Limit chunks if too many
            if len(chunks) > max_chunks:
                logger.info(f"Limiting to first {max_chunks} chunks for performance")
                chunks = chunks[:max_chunks]
            
            # Process each chunk
            for chunk_idx, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {chunk_idx + 1}/{len(chunks)}...")
                
                # Tokenize
                model_inputs = self.tokenizer(
                    chunk,
                    max_length=128,
                    padding=True,
                    truncation=True,
                    return_tensors='pt'
                )
                
                # Generate with maximum diversity (exact same as metta_reasoning.py)
                gen_kwargs = {
                    "max_length": 512,
                    "length_penalty": 0,
                    "num_beams": 5,
                    "num_return_sequences": 5,  # Get top 5 diverse outputs
                    "early_stopping": False,
                    "do_sample": False,
                }
                
                generated_tokens = self.model.generate(
                    model_inputs["input_ids"].to(self.model.device),
                    attention_mask=model_inputs["attention_mask"].to(self.model.device),
                    **gen_kwargs,
                )
                
                # Decode ALL sequences
                decoded_preds = self.tokenizer.batch_decode(generated_tokens, skip_special_tokens=False)
                
                logger.info(f"Generated {len(decoded_preds)} sequences for chunk {chunk_idx + 1}")
                
                # Parse each sequence
                chunk_triplets = []
                for seq_idx, pred in enumerate(decoded_preds):
                    seq_triplets = self.extract_triplets_from_text(pred)
                    if seq_triplets:
                        logger.info(f"  Seq {seq_idx + 1}: {len(seq_triplets)} triplets")
                        chunk_triplets.extend(seq_triplets)
                
                logger.info(f"Chunk {chunk_idx + 1} total: {len(chunk_triplets)} triplets")
                
                # Add to global list
                all_triples.extend(chunk_triplets)
            
            logger.info(f"Total raw triplets: {len(all_triples)}")
            
            # Deduplicate triplets
            seen = set()
            unique_triples = []
            
            for triplet in all_triples:
                # Normalize for deduplication
                key = (
                    triplet['head'].lower().strip(),
                    triplet['type'].lower().strip(),
                    triplet['tail'].lower().strip()
                )
                
                if key not in seen:
                    seen.add(key)
                    unique_triples.append({
                        'subject': triplet['head'],
                        'relation': triplet['type'],
                        'object': triplet['tail']
                    })
            
            logger.info(f"Unique triplets after deduplication: {len(unique_triples)}")
            
            # Add fallback patterns for critical info (like metta_reasoning.py)
            logger.info("Running fallback extraction for additional patterns...")
            fallback_triples = self.extract_triples_fallback(text)
            
            # Merge fallback with REBEL results
            for fb_triple in fallback_triples:
                key = (
                    fb_triple['subject'].lower().strip(),
                    fb_triple['relation'].lower().strip(),
                    fb_triple['object'].lower().strip()
                )
                if key not in seen:
                    seen.add(key)
                    unique_triples.append(fb_triple)
            
            logger.info(f"Final total: {len(unique_triples)} triplets")
            return unique_triples
            
        except Exception as e:
            logger.error(f"REBEL extraction failed: {str(e)}")
            import traceback
            traceback.print_exc()
            # Fallback to pattern matching only
            return self.extract_triples_fallback(text)
    
    def extract_triples_fallback(self, text: str) -> List[Dict[str, str]]:
        """Fallback triple extraction using regex patterns (exact copy from metta_reasoning.py)"""
        logger.info("Fallback: scanning for critical patterns...")
        triples = []
        
        # Pattern 1: Full name with birth date
        matches = re.finditer(r'([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\s*\(born\s+([^)]+)\)', text)
        for match in matches:
            full_name = match.group(1).strip()
            date = match.group(2).strip()
            name_parts = full_name.split()
            last_name = name_parts[-1]
            
            triples.append({
                'subject': last_name,
                'relation': 'full name',
                'object': full_name
            })
            triples.append({
                'subject': full_name,
                'relation': 'date of birth',
                'object': date
            })
            logger.info(f"Fallback: {last_name} -> full name -> {full_name}")
            logger.info(f"Fallback: {full_name} -> born -> {date}")
        
        # Pattern 2: Occupation
        sentences = re.split(r'[.!?]+', text)[:20]
        for sentence in sentences:
            match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:a|an)\s+((?:[a-z\-]+\s*){1,3}(?:singer|songwriter|artist|musician|actor))', sentence, re.IGNORECASE)
            if match:
                subject = match.group(1).strip()
                occupation = match.group(2).strip()
                triples.append({
                    'subject': subject,
                    'relation': 'occupation',
                    'object': occupation
                })
                logger.info(f"Fallback: {subject} -> occupation -> {occupation}")
        
        return triples

# ============================================================================
# MeTTa Knowledge Graph Builder
# ============================================================================

class MeTTaKnowledgeGraphBuilder:
    """Build and save MeTTa knowledge graphs"""
    
    def __init__(self):
        self.metta = MeTTa()
        self.atoms = []
    
    def triple_to_metta_atom(self, triple: Dict[str, str]) -> str:
        """Convert a triple to MeTTa atom format"""
        subject = triple['subject'].replace(' ', '_').replace('-', '_')
        relation = triple['relation'].replace(' ', '_').replace('-', '_')
        object_ = triple['object'].replace(' ', '_').replace('-', '_')
        
        # Create MeTTa atom: (= (relation subject object))
        atom = f"(= ({relation} {subject} {object_}))"
        return atom
    
    def build_knowledge_graph(self, triples: List[Dict[str, str]]) -> None:
        """Build MeTTa knowledge graph from triples"""
        logger.info(f"Building MeTTa knowledge graph from {len(triples)} triples...")
        
        for triple in triples:
            atom = self.triple_to_metta_atom(triple)
            self.atoms.append(atom)
            
            # Add to MeTTa interpreter
            try:
                self.metta.run(f'!(add-atom &self {atom})')
            except Exception as e:
                logger.warning(f"Failed to add atom '{atom}': {e}")
        
        # Add reasoning rules (like metta_reasoning.py)
        logger.info("Setting up reasoning rules...")
        self.metta.run("""
        !(add-atom &self
            (= (query $relation $subject)
                (match &self
                ($relation $subject $object)
                $object)))
        """)

        self.metta.run("""
        !(add-atom &self
            (= (query-inverse $relation $object)
                (match &self
                ($relation $subject $object)
                $subject)))
        """)
        
        logger.info(f"✅ Knowledge graph built with {len(self.atoms)} atoms")
    
    def save_knowledge_graph(self, output_path: str) -> None:
        """Save the knowledge graph to file"""
        logger.info(f"Saving knowledge graph to {output_path}...")
        
        # Save atoms as JSON for easy loading
        knowledge_data = {
            'atoms': self.atoms,
            'count': len(self.atoms)
        }
        
        with open(output_path, 'w') as f:
            json.dump(knowledge_data, f, indent=2)
        
        logger.info(f"✅ Knowledge graph saved to {output_path}")

# ============================================================================
# Template Index Builder
# ============================================================================

class TemplateIndexBuilder:
    """Build FAISS index for query templates"""
    
    def __init__(self):
        logger.info("Loading SentenceTransformer model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ SentenceTransformer model loaded")
    
    def build_fact_embeddings(self, triples: List[Dict[str, str]], token_id: str) -> str:
        """Build FAISS index for fact embeddings (like metta_reasoning.py)"""
        logger.info("Building fact embeddings index...")
        
        # Convert triples to natural language for embeddings
        fact_texts = []
        for triple in triples:
            subj = triple['subject'].replace('-', ' ')
            rel = triple['relation'].replace('-', ' ')
            obj = triple['object'].replace('-', ' ')
            fact_text = f"{subj} {rel} {obj}"
            fact_texts.append(fact_text)
        
        if not fact_texts:
            logger.warning("No facts to embed")
            return ""
        
        # Create embeddings
        embeddings = self.model.encode(fact_texts)
        
        # Create FAISS index
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        
        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)
        index.add(embeddings)
        
        # Save index
        output_path = f"fact_index_{token_id}.faiss"
        faiss.write_index(index, output_path)
        
        # Save fact mapping
        fact_mapping = {
            'facts': fact_texts,
            'triples': triples,
            'count': len(triples)
        }
        
        mapping_path = f"fact_mapping_{token_id}.json"
        with open(mapping_path, 'w') as f:
            json.dump(fact_mapping, f, indent=2)
        
        logger.info(f"✅ Fact embeddings index saved to {output_path}")
        logger.info(f"✅ Fact mapping saved to {mapping_path}")
        
        return output_path

# ============================================================================
# Main Ingestion Pipeline
# ============================================================================

class KnowledgeIngestionPipeline:
    """Main pipeline for knowledge ingestion"""
    
    def __init__(self):
        self.triple_extractor = REBELTripleExtractor()
        self.knowledge_builder = MeTTaKnowledgeGraphBuilder()
        self.template_builder = TemplateIndexBuilder()
    
    def ingest(self, source_file: str, token_id: str) -> None:
        """Run the complete ingestion pipeline"""
        logger.info("=" * 60)
        logger.info("🚀 EchoLink Knowledge Ingestion Pipeline")
        logger.info("=" * 60)
        logger.info(f"📁 Source: {source_file}")
        logger.info(f"🆔 Token ID: {token_id}")
        logger.info("")
        
        # Step 1: Load source text
        logger.info("📖 Step 1: Loading source text...")
        with open(source_file, 'r', encoding='utf-8') as f:
            source_text = f.read()
        logger.info(f"✅ Loaded {len(source_text)} characters")
        logger.info("")
        
        # Step 2: Extract triples using REBEL
        logger.info("🔍 Step 2: Extracting triples with REBEL...")
        triples = self.triple_extractor.extract_triples_from_text(source_text)
        logger.info("")
        
        # Step 3: Build MeTTa knowledge graph
        logger.info("🧠 Step 3: Building MeTTa knowledge graph...")
        self.knowledge_builder.build_knowledge_graph(triples)
        logger.info("")
        
        # Step 4: Save knowledge graph
        logger.info("💾 Step 4: Saving knowledge graph...")
        knowledge_path = f"knowledge_base_{token_id}.db"
        self.knowledge_builder.save_knowledge_graph(knowledge_path)
        logger.info("")
        
        # Step 5: Build fact embeddings index
        logger.info("🔍 Step 5: Building fact embeddings index...")
        fact_path = self.template_builder.build_fact_embeddings(triples, token_id)
        logger.info("")
        
        # Summary
        logger.info("=" * 60)
        logger.info("✅ INGESTION COMPLETE!")
        logger.info("=" * 60)
        logger.info(f"📊 Triples extracted: {len(triples)}")
        logger.info(f"🧠 MeTTa atoms: {len(self.knowledge_builder.atoms)}")
        logger.info(f"📁 Knowledge graph: {knowledge_path}")
        logger.info(f"🔍 Fact embeddings: {fact_path}")
        logger.info(f"📋 Fact mapping: fact_mapping_{token_id}.json")
        logger.info("")
        logger.info("🎯 Ready for intelligent querying!")

# ============================================================================
# CLI Interface
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='EchoLink Knowledge Ingestion Pipeline')
    parser.add_argument('source_file', help='Path to source text file')
    parser.add_argument('token_id', help='Unique token ID for this knowledge base')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate inputs
    if not os.path.exists(args.source_file):
        logger.error(f"Source file not found: {args.source_file}")
        sys.exit(1)
    
    if not args.token_id:
        logger.error("Token ID is required")
        sys.exit(1)
    
    # Run ingestion
    try:
        pipeline = KnowledgeIngestionPipeline()
        pipeline.ingest(args.source_file, args.token_id)
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
