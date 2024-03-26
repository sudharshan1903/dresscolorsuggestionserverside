import { MongoClient } from 'mongodb';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import fileUpload from 'express-fileupload';

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(fileUpload());

// Serve static files
app.use('/images', express.static(path.join(__dirname, 'images')));

let client;

async function createConnection() {
  try {
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('MongoDB connected');
  } catch (error) {
    console.error(error, 'MongoDB connection error');
    process.exit(1);
  }
}


createConnection();

// Routes
app.get('/homeTheme', async (req, res) => {
  try {
    const homeThemes = await client.db('dress-color-suggestion').collection('homePages').find().toArray();
    res.json(homeThemes);
  } catch (error) {
    console.error(error, 'DB error');
    res.send('Internal Server Error');
  }
});

app.get('/dressTheme', async (req, res) => {
  try {
    const dressThemes = await client
      .db('dress-color-suggestion')
      .collection('dressCollectionTheme')
      .aggregate([{ $sample: { size: 1 } }])
      .toArray();

    res.json(dressThemes);
  } catch (error) {
    console.error(error, 'DB error');
    res.send('Internal Server Error');
  }
});

app.post('/Register', async (req, res) => {
  const { userName, email, password } = req.body;

  try {
    const existingUser = await client.db('dress-color-suggestion').collection('users').findOne({ email });

    if (existingUser) {
      res.json({ success: false, message: 'User with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const result = await client.db('dress-color-suggestion').collection('users').insertOne({
      userName,
      email,
      password: hashPassword,
      isAdmin: false,
    });

    res.json({ success: true, message: 'Registration successful.' });
  } catch (error) {
    console.error(error, 'DB error');
    res.json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/Login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await client.db('dress-color-suggestion').collection('users').findOne({ email });

    if (!user) {
      res.json({ success: false, message: 'User not found.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);

    if (match) {
      if (user.isAdmin) {
        res.json({ success: true, isAdmin: true, message: 'Admin login successful.' });
      } else {
        res.json({ success: true, isAdmin: false, message: 'User login successful.' });
      }
    } else {
      res.json({ success: false, message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error(error, 'DB error');
    res.json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/AdminLogin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await client.db('dress-color-suggestion').collection('users').findOne({ email, isAdmin: true });

    if (!admin) {
      res.json({ success: false, message: 'Admin not found.' });
      return;
    }

    const match = await bcrypt.compare(password, admin.password);

    if (match) {
      res.json({ success: true, message: 'Admin login successful.' });
    } else {
      res.json({ success: false, message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error(error, 'DB error');
    res.json({ success: false, message: 'Internal Server Error' });
  }
});

// Admin upload dress collections
app.post('/AdminUpload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    const { file } = req.files;
    const relativePath = `/images/${file.name}`;
    const uploadPath = path.join(__dirname, 'images', file.name);
    await file.mv(uploadPath);

    const result = await client
      .db('dress-color-suggestion')
      .collection('dressCollectionTheme')
      .insertOne({
        imageName: file.name,
        dressImage: `https://dresscolorsuggestionserverside.onrender.com/images/${file.name}`,
      });

    res.json({ success: true, message: 'File uploaded successfully.', fileId: result.insertedId });
  } catch (error) {
    console.error(error, 'File upload error');
    res.json({ success: false, message: 'Internal Server Error' });
  }
});

app.listen(PORT, () => console.log('Server started on PORT', PORT));
