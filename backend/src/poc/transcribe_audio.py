#!/usr/bin/env python3
"""
EchoLink Audio/Video Transcription Script
Uses local Whisper model for transcription without requiring API keys
"""

import sys
import os
import argparse
import logging
from pathlib import Path

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import torch
    from transformers import WhisperProcessor, WhisperForConditionalGeneration
    import librosa
    import numpy as np
except ImportError as e:
    print(f"❌ Missing required dependencies: {e}")
    print("Please install required packages:")
    print("pip install torch transformers librosa")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocalWhisperTranscriber:
    """Local Whisper transcription using transformers library"""
    
    def __init__(self, model_name="openai/whisper-base"):
        """Initialize the transcriber with a Whisper model"""
        self.model_name = model_name
        self.processor = None
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.info(f"🚀 Initializing Whisper transcriber with model: {model_name}")
        logger.info(f"🖥️ Using device: {self.device}")
        
    def load_model(self):
        """Load the Whisper model and processor"""
        try:
            logger.info("📥 Loading Whisper model...")
            self.processor = WhisperProcessor.from_pretrained(self.model_name)
            self.model = WhisperForConditionalGeneration.from_pretrained(self.model_name)
            self.model.to(self.device)
            logger.info("✅ Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load Whisper model: {e}")
            raise
    
    def transcribe_file(self, audio_path: str) -> str:
        """Transcribe an audio file using local Whisper model"""
        try:
            logger.info(f"🎵 Transcribing audio file: {audio_path}")
            
            # Load and preprocess audio
            audio, sr = librosa.load(audio_path, sr=16000)  # Whisper expects 16kHz
            
            # Process audio
            input_features = self.processor(
                audio, 
                sampling_rate=16000, 
                return_tensors="pt"
            ).input_features.to(self.device)
            
            # Generate transcription
            logger.info("🎤 Generating transcription...")
            with torch.no_grad():
                predicted_ids = self.model.generate(input_features)
            
            # Decode transcription
            transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
            
            logger.info("✅ Transcription completed successfully")
            return transcription
            
        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise

def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description="Transcribe audio/video files using local Whisper")
    parser.add_argument("input_file", help="Path to the audio/video file to transcribe")
    parser.add_argument("--model", default="openai/whisper-base", help="Whisper model to use")
    parser.add_argument("--output", help="Output file path (optional)")
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_file):
        print(f"❌ Input file not found: {args.input_file}")
        sys.exit(1)
    
    try:
        # Initialize transcriber
        transcriber = LocalWhisperTranscriber(args.model)
        transcriber.load_model()
        
        # Transcribe file
        transcription = transcriber.transcribe_file(args.input_file)
        
        # Output result
        print("=" * 80)
        print("📝 TRANSCRIPTION RESULT:")
        print("=" * 80)
        print(transcription)
        print("=" * 80)
        
        # Save to output file if specified
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(transcription)
            print(f"💾 Transcription saved to: {args.output}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
