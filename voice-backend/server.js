import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import gTTS from 'gtts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/transcribe', upload.single('audio'), (req, res) => {
  const filePath = req.file.path;
  const outPath = `${filePath}.wav`;

  exec(`ffmpeg -i ${filePath} -ar 16000 -ac 1 -f wav ${outPath}`, async (err) => {
    if (err) {
      console.error('FFmpeg error:', err);
      return res.status(500).send('Audio conversion failed.');
    }

    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(outPath),
        model: 'whisper-1'
      });

      res.json({ transcript: transcript.text });
    } catch (err) {
      console.error('Transcription error:', err);
      res.status(500).send('Transcription failed.');
    } finally {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outPath);
    }
  });
});

app.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;
    const outputPath = path.join(__dirname, 'output.mp3');

    const gtts = new gTTS(text, 'en');
    const writeStream = fs.createWriteStream(outputPath);

    gtts.stream()
      .pipe(writeStream)
      .on('finish', () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'audio/mpeg');
        const stream = fs.createReadStream(outputPath);
        stream.pipe(res);

        stream.on('close', () => {
          fs.unlinkSync(outputPath);
        });
      })
      .on('error', (err) => {
        console.error('TTS error:', err);
        res.setHeader('Access-Control-Allow-Origin', '*'); // still allow cors
        res.status(500).send('TTS generation failed.');
      });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).send('Server error.');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
