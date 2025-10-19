"""
MeTTa Reasoning Module (Refactored for direct import)
NLP-enhanced relation extraction using REBEL model
Converts to MeTTa facts and performs symbolic reasoning
"""

import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Try to import transformers (REBEL model), fallback if unavailable
try:
    from transformers import pipeline
    REBEL_AVAILABLE = True
except ImportError:
    REBEL_AVAILABLE = False
    logger.warning("transformers not available, using fallback extraction")


def extract_triples_with_rebel(text: str, max_length: int = 2000) -> List[Dict[str, str]]:
    """
    Extract Subject-Predicate-Object triples using REBEL model.
    
    Args:
        text: Input text
        max_length: Maximum text length to process
        
    Returns:
        List of dicts with 'subject', 'relation', 'object' keys
    """
    if not REBEL_AVAILABLE:
        return extract_triples_fallback(text)
    
    triples = []
    
    try:
        # Initialize REBEL pipeline
        extractor = pipeline(
            "text2text-generation",
            model="Babelscape/rebel-large",
            device=-1  # CPU mode
        )
        
        # Truncate if too long
        text_chunk = text[:max_length]
        
        # Generate triples
        outputs = extractor(
            text_chunk,
            max_length=256,
            num_beams=3,
            num_return_sequences=1
        )
        
        if not outputs:
            return extract_triples_fallback(text)
        
        extracted_text = outputs[0]['generated_text']
        
        # Parse REBEL output: <triplet> subj <subj> pred <obj> obj
        triplet_pattern = r'<triplet>\s*([^<]+?)\s*<subj>\s*([^<]+?)\s*<obj>\s*([^<]+?)(?=\s*<triplet>|$)'
        matches = re.findall(triplet_pattern, extracted_text)
        
        for match in matches:
            subject = match[0].strip()
            predicate = match[1].strip()
            object_ = match[2].strip()
            
            if subject and predicate and object_:
                triples.append({
                    'subject': subject,
                    'relation': predicate,
                    'object': object_
                })
        
        logger.info(f"REBEL extracted {len(triples)} triples")
        
    except Exception as e:
        logger.warning(f"REBEL extraction failed: {e}, using fallback")
        triples = extract_triples_fallback(text)
    
    return triples


def extract_triples_fallback(text: str) -> List[Dict[str, str]]:
    """
    Fallback triple extraction using regex patterns.
    """
    triples = []
    sentences = re.split(r'[.!?]+', text)
    
    for sentence in sentences[:15]:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # Pattern: "X uses Y"
        match = re.search(
            r'(\w+(?:\s+\w+)*)\s+uses?\s+([A-Z][\w\-]+(?:\s+[A-Z][\w\-]+)*)',
            sentence,
            re.IGNORECASE
        )
        if match:
            triples.append({
                'subject': match.group(1).strip(),
                'relation': 'uses',
                'object': match.group(2).strip()
            })
        
        # Pattern: "X is energy-intensive" or "X is eco-friendly"
        match = re.search(
            r'([A-Z][\w\-]+(?:\s+[A-Z][\w\-]+)*)\s+is\s+(energy-intensive|eco-friendly|decentralized|secure)',
            sentence,
            re.IGNORECASE
        )
        if match:
            triples.append({
                'subject': match.group(1).strip(),
                'relation': 'has-property',
                'object': match.group(2).strip()
            })
    
    logger.info(f"Fallback extracted {len(triples)} triples")
    return triples


def triples_to_metta_facts(triples: List[Dict[str, str]]) -> List[str]:
    """
    Convert structured triples to MeTTa fact strings.
    """
    facts = []
    
    for triple in triples:
        subject = triple['subject'].replace(' ', '-').replace(',', '').replace('(', '').replace(')', '')
        relation = triple['relation'].replace(' ', '-').lower()
        object_ = triple['object'].replace(' ', '-').replace(',', '').replace('(', '').replace(')', '')
        
        # Map relations
        relation_map = {
            'uses': 'uses',
            'has-property': 'is-property',
            'is': 'is-property',
            'requires': 'requires',
            'has': 'has'
        }
        
        metta_relation = relation_map.get(relation, relation)
        
        # Special handling for properties
        if 'energy' in object_.lower() and 'intensive' in object_.lower():
            fact = f'(is-energy-intensive {subject})'
        elif 'eco-friendly' in object_.lower():
            fact = f'(is-eco-friendly {subject})'
        else:
            fact = f'({metta_relation} {subject} {object_})'
        
        facts.append(fact)
    
    return facts


def extract_relations_and_reason(
    context: str,
    question: str,
    metta_kb
) -> Optional[str]:
    """
    Extract relations from context and perform MeTTa reasoning.
    Main function called by the query pipeline.
    
    Args:
        context: Retrieved context from RAG
        question: User's question
        metta_kb: MeTTa knowledge base instance
        
    Returns:
        Deduced answer or None
    """
    logger.info(f"Extracting relations from {len(context)} chars...")
    
    # Extract triples
    triples = extract_triples_with_rebel(context, max_length=5000)
    
    if not triples:
        logger.warning("No triples extracted")
        return None
    
    logger.info(f"Extracted {len(triples)} triples: {triples[:3]}...")
    
    # Convert to MeTTa facts
    facts = triples_to_metta_facts(triples)
    logger.info(f"Generated {len(facts)} MeTTa facts")
    
    # Add facts to knowledge base
    metta_kb.add_facts(facts)
    
    # Perform reasoning on extracted entities
    results = []
    for triple in triples:
        subject = triple['subject']
        deductions = metta_kb.reason(subject)
        results.extend(deductions)
    
    if results:
        # Clean and return first deduction
        answer = results[0].replace('[', '').replace(']', '').strip()
        logger.info(f"MeTTa deduced: {answer}")
        return answer
    else:
        # Return first extracted concept as fallback
        if triples:
            return triples[0]['object']
        return None

