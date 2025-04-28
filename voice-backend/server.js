import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { exec } from 'child_process';
import { getAudioUrl } from 'google-tts-api';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Transcription endpoint
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
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).send('Transcription failed.');
    } finally {
      fs.unlinkSync(filePath);
      fs.unlinkSync(outPath);
    }
  });
});

// Text-to-speech endpoint
app.post('/speak', async (req, res) => {
  const { text } = req.body;

  try {
    const url = await getAudioUrl(text, { lang: 'en', slow: false });
    res.json({ url });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).send('TTS generation failed.');
  }
});

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
