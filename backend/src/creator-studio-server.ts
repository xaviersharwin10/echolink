/**
 * EchoLink Creator Studio Backend
 * Handles file uploads and knowledge ingestion for Echo NFT creation
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { spawn } from 'child_process';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ffmpeg from 'fluent-ffmpeg';

const app = express();
const PORT = process.env.CREATOR_STUDIO_PORT || 8000;

// Python transcription script path
const TRANSCRIBE_SCRIPT_PATH = path.join(__dirname, '../src/poc/transcribe_audio.py');

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, DOCX, MP4, MOV, MP3, WAV files are allowed.'));
    }
  }
});

// ============================================================================
// File Processing Functions
// ============================================================================

async function runPythonTranscription(audioPath: string): Promise<string> {
  console.log(`🐍 Running Python transcription script for: ${audioPath}`);
  
  return new Promise((resolve, reject) => {
    // Use venv Python instead of system python3
    const venvPythonPath = path.join(__dirname, '../src/poc/venv/bin/python');
    
    const pythonProcess = spawn(venvPythonPath, [TRANSCRIBE_SCRIPT_PATH, audioPath], {
      cwd: path.join(__dirname, '../src/poc'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`📝 Transcription stdout: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`⚠️ Transcription stderr: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Transcription completed successfully`);
        
        // Extract transcription from stdout (look for the result between the markers)
        const lines = stdout.split('\n');
        const startMarker = '📝 TRANSCRIPTION RESULT:';
        const endMarker = '='.repeat(80);
        
        let transcription = '';
        let capturing = false;
        
        for (const line of lines) {
          if (line.includes(startMarker)) {
            capturing = true;
            continue;
          }
          if (capturing && line.includes(endMarker)) {
            break;
          }
          if (capturing && line.trim()) {
            transcription += line + '\n';
          }
        }
        
        if (transcription.trim()) {
          resolve(transcription.trim());
        } else {
          // Fallback: return the entire stdout if we can't parse it
          resolve(stdout.trim() || '[Transcription completed but no text extracted]');
        }
      } else {
        console.error(`❌ Transcription failed with code ${code}`);
        console.error(`stderr: ${stderr}`);
        reject(new Error(`Transcription script failed with exit code ${code}: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Failed to start transcription script:`, error);
      reject(error);
    });
  });
}

async function transcribeVideo(filePath: string): Promise<string> {
  console.log(`🎥 Starting video transcription for: ${filePath}`);
  
  try {
    // Extract audio from video using ffmpeg
    const audioPath = filePath.replace(path.extname(filePath), '.mp3');
    
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .toFormat('mp3')
        .on('end', () => {
          console.log('✅ Audio extraction completed');
          resolve(audioPath);
        })
        .on('error', (err: any) => {
          console.error('❌ Audio extraction failed:', err);
          reject(err);
        })
        .save(audioPath);
    });
    
    // Transcribe audio using local Python Whisper script
    console.log('🎤 Starting transcription with local Whisper model...');
    const transcription = await runPythonTranscription(audioPath);
    
    // Clean up temporary audio file
    await fs.remove(audioPath);
    
    console.log('✅ Video transcription completed');
    console.log(`📝 Transcription result: ${transcription}`);
    return transcription;
    
  } catch (error: any) {
    console.error('❌ Video transcription failed:', error);
    throw new Error(`Video transcription failed: ${error.message}`);
  }
}

async function transcribeAudio(filePath: string): Promise<string> {
  console.log(`🎵 Starting audio transcription for: ${filePath}`);
  
  try {
    // Transcribe audio using local Python Whisper script
    console.log('🎤 Starting transcription with local Whisper model...');
    const transcription = await runPythonTranscription(filePath);
    
    console.log('✅ Audio transcription completed');
    console.log(`📝 Transcription result: ${transcription}`);
    return transcription;
    
  } catch (error: any) {
    console.error('❌ Audio transcription failed:', error);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
}

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  console.log(`📄 Extracting text from ${mimeType} file: ${filePath}`);
  
  try {
    if (mimeType === 'text/plain') {
      return await fs.readFile(filePath, 'utf-8');
    }
    
    if (mimeType === 'application/pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    }
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    
    if (mimeType.startsWith('video/')) {
      // Transcribe video files
      return await transcribeVideo(filePath);
    }
    
    if (mimeType.startsWith('audio/')) {
      // Transcribe audio files
      return await transcribeAudio(filePath);
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    console.error(`❌ Error extracting text from ${filePath}:`, error);
    throw error;
  }
}

function generateKnowledgeHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function generateTokenId(): string {
  return (Date.now() % 10_000_000_000).toString().padStart(10, '0');
}

async function runIngestionScript(textFilePath: string, tokenId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🐍 Running ingestion script for token ${tokenId}`);
      
      const scriptPath = path.join(__dirname, '../src/poc/ingest.py');
      
      // Use venv Python instead of system python3
      const venvPythonPath = path.join(__dirname, '../src/poc/venv/bin/python');
      
      const pythonProcess = spawn(venvPythonPath, [scriptPath, textFilePath, tokenId], {
        cwd: path.join(__dirname, '../src/poc'),
        stdio: ['pipe', 'pipe', 'pipe']
      });
  
      let stdout = '';
      let stderr = '';
  
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`📝 Ingestion stdout: ${data.toString()}`);
      });
  
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`⚠️ Ingestion stderr: ${data.toString()}`);
      });
  
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Ingestion completed successfully for token ${tokenId}`);
          resolve();
        } else {
          console.error(`❌ Ingestion failed with code ${code}`);
          console.error(`stderr: ${stderr}`);
          reject(new Error(`Ingestion script failed with exit code ${code}`));
        }
      });
  
      pythonProcess.on('error', (error) => {
        console.error(`❌ Failed to start ingestion script:`, error);
        reject(error);
      });
    });
  }

// ============================================================================
// API Endpoints
// ============================================================================

app.post('/api/ingest-single-knowledge', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Received file upload request');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, mimetype, size, path: filePath } = req.file;
    console.log(`📁 File details: ${originalname} (${mimetype}, ${size} bytes)`);

    // Extract text from the uploaded file
    const extractedText = await extractTextFromFile(filePath, mimetype);
    console.log(`📝 Extracted text length: ${extractedText.length} characters`);
    
    // Print the extracted text content to console for verification
    console.log('='.repeat(80));
    console.log('📄 EXTRACTED TEXT CONTENT:');
    console.log('='.repeat(80));
    console.log(extractedText);
    console.log('='.repeat(80));
    console.log('📄 END OF EXTRACTED TEXT CONTENT');
    console.log('='.repeat(80));

    // Generate knowledge hash and token ID
    const knowledgeHash = generateKnowledgeHash(extractedText);
    const tokenId = generateTokenId();
    
    console.log(`🔑 Generated knowledge hash: ${knowledgeHash}`);
    console.log(`🆔 Generated token ID: ${tokenId}`);

    // Save extracted text to temporary file
    const tempTextPath = path.join(__dirname, '../temp', `temp_knowledge_${tokenId}.txt`);
    await fs.ensureDir(path.dirname(tempTextPath));
    await fs.writeFile(tempTextPath, extractedText, 'utf-8');
    console.log(`💾 Saved extracted text to: ${tempTextPath}`);

    // Start ingestion process in background
    runIngestionScript(tempTextPath, tokenId).catch(error => {
      console.error(`❌ Background ingestion failed for token ${tokenId}:`, error);
    });

    // Clean up uploaded file
    await fs.remove(filePath);

    // Send immediate response
    res.json({
      success: true,
      knowledgeHash,
      tokenId,
      fileName: originalname,
      fileSize: size,
      extractedTextLength: extractedText.length,
      message: 'File processed successfully. Knowledge ingestion is running in the background.'
    });

  } catch (error: any) {
    console.error('❌ File processing error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      error: 'Failed to process file',
      message: error.message
    });
  }
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'echolink-creator-studio',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 100MB'
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🎨 EchoLink Creator Studio Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log('');
  console.log('📍 Endpoints:');
  console.log('   POST /api/ingest-single-knowledge  → File upload and processing');
  console.log('   GET  /health                      → Health check');
  console.log('');
  console.log('🎯 Features:');
  console.log('   • File upload (TXT, PDF, DOCX, MP4, MOV, MP3, WAV)');
  console.log('   • Text extraction and processing');
  console.log('   • Audio/Video transcription (Local Whisper Model)');
  console.log('   • Knowledge hash generation');
  console.log('   • Background ingestion pipeline');
  console.log('='.repeat(60));
});

export default app;
