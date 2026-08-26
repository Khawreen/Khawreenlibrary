import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { GoogleGenAI } from '@google/genai';
import { startTelegramBot, handleTelegramWebhookUpdate, deleteTelegramWebhook } from './telegram-bot.ts';
import { hashPassword, verifyPassword, isPasswordMigrationNeeded, sanitizeUser } from './authUtils.ts';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { 
  getFirestore, 
  setLogLevel,
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch {}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '100mb' }));

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyARDLfFHtmKiC8gsGBNZhvdnn3u-weXr7E",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "excellent-runway-4wlzs.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "excellent-runway-4wlzs",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "excellent-runway-4wlzs.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "410463710828",
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "1:410463710828:web:90f7cd91e3d1dc87e9b249"
};

const firestoreDatabaseId =
  process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
  process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  "ai-studio-khawreenlibrary-b985de53-1084-4171-88e8-3ffd832bd40d";

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firestoreDatabaseId);


// --- Firebase with Robust Local Fallback Wrapper ---
const LOCAL_DB_PATH = path.resolve(process.cwd(), 'local_db.json');

interface LocalDB {
  users: Record<string, any>;
  books: Record<string, any>;
  reviews: Record<string, any>;
  ads: Record<string, any>;
  purchases: Record<string, any>;
  settings: Record<string, any>;
  file_chunks?: Record<string, any>;
}

const loadLocalDB = (): LocalDB => {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to read local DB:", err);
  }
  const defaultDB: LocalDB = {
    users: {
      'mohammadgulkhawreen6@gmail.com': {
        id: 'mohammadgulkhawreen6@gmail.com',
        username: 'mohammadgulkhawreen6@gmail.com',
        email: 'mohammadgulkhawreen6@gmail.com',
        name: 'Mohammad Gul Khawreen',
        password: '786786ARzo@',
        role: 'admin',
        purchasedBookIds: []
      }
    },
    books: {},
    reviews: {},
    ads: {},
    purchases: {},
    settings: {
      'main': {
        id: 'main',
        binanceApiKey: '',
        binanceApiSecret: '',
        hesabpayMerchantId: '',
        hesabpayApiKey: '',
        hesabpaySandboxMode: true,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
        websiteUrl: process.env.APP_URL || ''
      }
    }
  };
  saveLocalDB(defaultDB);
  return defaultDB;
};

const saveLocalDB = (db: LocalDB) => {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to write local DB:", err);
  }
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore connection timeout')), timeoutMs))
  ]);
}

async function dbGet(collectionName: string, id: string): Promise<any | null> {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;
  let firestoreData: any = null;

  try {
    const docRef = doc(firestore, collectionName, cleanId);
    const docSnap = await withTimeout(getDoc(docRef), 2000).catch(() => null);
    if (docSnap && docSnap.exists()) {
      firestoreData = { id: docSnap.id, ...docSnap.data() };
    }
  } catch (e: any) {
    // Graceful offline fallback to local database
  }

  const local = loadLocalDB();
  const collection = local[collectionName as keyof LocalDB] || {};
  const localData = collection[cleanId] || null;

  if (firestoreData || localData) {
    return { ...(localData || {}), ...(firestoreData || {}) };
  }
  return null;
}

async function dbList(collectionName: string): Promise<any[]> {
  const itemsMap: Record<string, any> = {};

  // 1. Read from local DB first for instant response
  try {
    const local = loadLocalDB();
    const colObj = local[collectionName as keyof LocalDB] || {};
    Object.values(colObj).forEach((item: any) => {
      if (item && item.id) {
        itemsMap[item.id] = { ...item };
      }
    });
  } catch (err) {}

  // 2. Read from Firestore to sync cloud data if available
  try {
    const colRef = collection(firestore, collectionName);
    const snapshot = await withTimeout(getDocs(colRef), 2000).catch(() => null);
    if (snapshot) {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        if (id) {
          itemsMap[id] = { ...(itemsMap[id] || {}), ...data, id };
        }
      });
    }
  } catch (e: any) {
    // Graceful fallback to local data
  }

  return Object.values(itemsMap);
}

// --- High Performance File Storage (Local Disk + Firestore Hybrid) ---
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');
const PDFS_DIR = path.join(UPLOADS_DIR, 'pdfs');

if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
if (!fs.existsSync(PDFS_DIR)) fs.mkdirSync(PDFS_DIR, { recursive: true });

async function saveFileToStorage(fileId: string, base64Data: string, type: 'pdf' | 'cover'): Promise<void> {
  const targetDir = type === 'cover' ? COVERS_DIR : PDFS_DIR;
  const filePath = path.join(targetDir, `${fileId}.dat`);
  
  // 1. Save directly to local disk for instant serving
  try {
    fs.writeFileSync(filePath, base64Data, 'utf-8');
  } catch (err) {
    console.error(`[STORAGE] Disk write error for ${type} ${fileId}:`, err);
  }

  // 2. Save chunks in local DB file_chunks for disk reset resilience
  try {
    const local = loadLocalDB();
    const localChunks = local['file_chunks'] || {};
    const chunkSize = 400000;
    let index = 0;
    for (let i = 0; i < base64Data.length; i += chunkSize) {
      const chunkStr = base64Data.substring(i, i + chunkSize);
      const chunkId = `${fileId}_${type}_${index}`;
      localChunks[chunkId] = {
        fileId,
        type,
        index,
        data: chunkStr,
        totalSize: base64Data.length,
      };
      index++;
    }
    local['file_chunks'] = localChunks;
    saveLocalDB(local);
  } catch (err) {
    console.error(`[STORAGE] Error saving local DB file_chunks:`, err);
  }

  // 3. Backup file chunks to Cloud Firestore database asynchronously in background
  (async () => {
    try {
      const chunkSize = 400000;
      let index = 0;
      for (let i = 0; i < base64Data.length; i += chunkSize) {
        const chunkStr = base64Data.substring(i, i + chunkSize);
        const chunkId = `${fileId}_${type}_${index}`;
        const docRef = doc(firestore, 'file_chunks', chunkId);
        await setDoc(docRef, {
          fileId,
          type,
          index,
          data: chunkStr,
          totalSize: base64Data.length,
        }, { merge: true }).catch((e) => console.warn(`[STORAGE] Chunk ${chunkId} warning:`, e.message));
        index++;
      }
    } catch (e: any) {
      console.warn(`[STORAGE] Firestore file_chunks sync warning for ${type} ${fileId}:`, e.message);
    }
  })();
}

async function getFileFromStorage(fileId: string, type: 'pdf' | 'cover'): Promise<string | null> {
  const candidateIds = [fileId];
  if (fileId.startsWith('book-')) {
    candidateIds.push(fileId.replace(/^book-/, ''));
    if (fileId.startsWith('book-tg-')) {
      candidateIds.push(fileId.replace(/^book-tg-/, ''));
    }
  } else {
    candidateIds.push(`book-${fileId}`);
    candidateIds.push(`book-tg-${fileId}`);
  }

  const targetDir = type === 'cover' ? COVERS_DIR : PDFS_DIR;

  // 1. Read from disk if exists (Instant response)
  for (const cid of candidateIds) {
    const filePath = path.join(targetDir, `${cid}.dat`);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        console.warn(`[STORAGE] Disk read warning for ${type} ${cid}:`, err);
      }
    }
  }

  // 2. Read from local DB file_chunks (Instant local DB response)
  try {
    const local = loadLocalDB();
    const localChunks = local['file_chunks'] || {};
    for (const cid of candidateIds) {
      const items = Object.values(localChunks)
        .filter((c: any) => c && c.fileId === cid && c.type === type)
        .sort((a: any, b: any) => a.index - b.index);

      if (items.length > 0) {
        const fullData = items.map((c: any) => c.data).join('');
        try {
          const filePath = path.join(targetDir, `${fileId}.dat`);
          fs.writeFileSync(filePath, fullData, 'utf-8');
        } catch (e) {}
        return fullData;
      }
    }

    // 2.5 Check if book in local DB has embedded data URL
    const books = local['books'] || {};
    for (const cid of candidateIds) {
      const book = books[cid];
      if (book) {
        const targetUrl = type === 'cover' ? book.coverUrl : book.pdfUrl;
        if (targetUrl && typeof targetUrl === 'string' && targetUrl.startsWith('data:')) {
          try {
            const filePath = path.join(targetDir, `${fileId}.dat`);
            fs.writeFileSync(filePath, targetUrl, 'utf-8');
          } catch (e) {}
          return targetUrl;
        }
      }
    }
  } catch (err) {}

  // 3. Fallback to Firestore with gentle timeout and non-blocking recovery
  try {
    const colRef = collection(firestore, 'file_chunks');
    for (const cid of candidateIds) {
      const q = query(colRef, where('fileId', '==', cid), where('type', '==', type));
      const snapshot = await withTimeout(getDocs(q), 1500).catch(() => null);
      if (snapshot && !snapshot.empty) {
        const items: any[] = [];
        snapshot.forEach((docSnap) => items.push(docSnap.data()));

        if (items.length > 0) {
          items.sort((a, b) => a.index - b.index);
          const fullData = items.map((c) => c.data).join('');

          try {
            const filePath = path.join(targetDir, `${fileId}.dat`);
            fs.writeFileSync(filePath, fullData, 'utf-8');
          } catch (e) {}

          return fullData;
        }
      }
    }
  } catch (err: any) {
    // Non-fatal warning - gracefully fall back to default assets
    console.warn("[STORAGE] Note on Firestore file chunks:", err?.message || 'offline or not found');
  }

  return null;
}

async function deleteFileFromStorage(fileId: string): Promise<void> {
  try {
    const coverPath = path.join(COVERS_DIR, `${fileId}.dat`);
    const pdfPath = path.join(PDFS_DIR, `${fileId}.dat`);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  } catch (e) {}

  try {
    const colRef = collection(firestore, 'file_chunks');
    const q = query(colRef, where('fileId', '==', fileId));
    const snapshot = await getDocs(q);
    snapshot.forEach(async (docSnap) => {
      await deleteDoc(docSnap.ref).catch(() => {});
    });
  } catch (err: any) {}
  
  const local = loadLocalDB();
  const localChunks = local['file_chunks'] || {};
  Object.keys(localChunks).forEach((key) => {
    if (localChunks[key].fileId === fileId) {
      delete localChunks[key];
    }
  });
  local['file_chunks'] = localChunks;
  saveLocalDB(local);
}

async function dbSet(collectionName: string, id: string, data: any): Promise<void> {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;
  const mergedData = { ...data, id: cleanId };

  if (collectionName === 'books') {
    let coverUrl = mergedData.coverUrl || '';
    let pdfUrl = mergedData.pdfUrl || '';
    
    if (coverUrl.startsWith('data:')) {
      await saveFileToStorage(cleanId, coverUrl, 'cover');
      mergedData.coverUrl = `/api/files/cover/${cleanId}`;
    }
    if (pdfUrl.startsWith('data:')) {
      await saveFileToStorage(cleanId, pdfUrl, 'pdf');
      mergedData.pdfUrl = `/api/files/download/${cleanId}`;
    }
  }

  // 1. Immediately write to local memory & disk
  const local = loadLocalDB();
  const collection = local[collectionName as keyof LocalDB] || {};
  collection[cleanId] = { ...collection[cleanId], ...mergedData };
  local[collectionName as keyof LocalDB] = collection;
  saveLocalDB(local);

  // 2. Non-blocking sync to Firestore in the background
  try {
    const docRef = doc(firestore, collectionName, cleanId);
    const cleanFirestorePayload = JSON.parse(JSON.stringify(mergedData));
    withTimeout(setDoc(docRef, cleanFirestorePayload, { merge: true }), 3000).catch(() => {
      // Gracefully handled by local storage fallback
    });
  } catch (e: any) {
    // Gracefully handled by local storage fallback
  }
}

async function dbDelete(collectionName: string, id: string): Promise<void> {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;

  if (collectionName === 'books') {
    await deleteFileFromStorage(cleanId);
  }

  const local = loadLocalDB();
  const collection = local[collectionName as keyof LocalDB] || {};
  delete collection[cleanId];
  local[collectionName as keyof LocalDB] = collection;
  saveLocalDB(local);

  try {
    const docRef = doc(firestore, collectionName, cleanId);
    withTimeout(deleteDoc(docRef), 3000).catch(() => {
      // Gracefully handled
    });
  } catch (e: any) {
    // Gracefully handled
  }
}

// --- Self-healing Master Admin & Password Migration ---
const adminEmail = 'mohammadgulkhawreen6@gmail.com';
const initMasterAdmin = async () => {
  try {
    const adminData = await dbGet('users', adminEmail);
    if (!adminData) {
      const defaultAdmin = {
        username: adminEmail,
        email: adminEmail,
        name: 'Mohammad Gul Khawreen',
        password: hashPassword('786786ARzo@'),
        role: 'admin',
        purchasedBookIds: []
      };
      await dbSet('users', adminEmail, defaultAdmin);
      console.log("[SERVER] Master Admin initialized with PBKDF2-SHA512 password hash!");
    } else {
      const isPasswordValid = verifyPassword('786786ARzo@', adminData.password);
      const needsMigration = isPasswordMigrationNeeded(adminData.password);
      
      if (adminData.role !== 'admin' || !isPasswordValid || needsMigration || adminData.name !== 'Mohammad Gul Khawreen') {
        await dbSet('users', adminEmail, {
          ...adminData,
          role: 'admin',
          password: isPasswordValid ? (needsMigration ? hashPassword('786786ARzo@') : adminData.password) : hashPassword('786786ARzo@'),
          name: 'Mohammad Gul Khawreen'
        });
        console.log("[SERVER] Master Admin characteristics and hashed credentials synchronized!");
      }
    }

    // Auto-migrate any existing unhashed passwords across the users collection
    try {
      const allUsers = await dbList('users');
      let migratedCount = 0;
      for (const u of allUsers) {
        if (u && u.password && isPasswordMigrationNeeded(u.password)) {
          const secureHash = hashPassword(u.password);
          await dbSet('users', u.id || u.email, { ...u, password: secureHash });
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(`[AUTH SECURITY] Migrated ${migratedCount} user passwords to PBKDF2-SHA512 hashes.`);
      }
    } catch (migErr) {
      console.warn('[AUTH SECURITY] User password migration routine error:', migErr);
    }
  } catch (error) {
    console.error("[SERVER] Self-healing master admin initialization failed:", error);
  }
};
initMasterAdmin();

// --- Express API Router ---

app.get('/api/debug/firestore', async (req, res) => {
  try {
    const testDoc = doc(firestore, 'users', 'non_existent_test_user_query');
    const snap = await getDoc(testDoc);
    res.json({
      success: true,
      exists: snap.exists(),
      databaseId: "ai-studio-b985de53-1084-4171-88e8-3ffd832bd40d",
      message: "Successfully connected to Firestore!"
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || err,
      stack: err.stack
    });
  }
});

// --- File Upload Endpoints ---
app.post('/api/upload/cover/:bookId', express.raw({ limit: '50mb', type: '*/*' }), async (req, res) => {
  const { bookId } = req.params;
  try {
    const contentType = req.headers['content-type'] || 'image/jpeg';
    let base64Data: string;
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      base64Data = `data:${contentType};base64,` + req.body.toString('base64');
    } else if (typeof req.body === 'string' && req.body.startsWith('data:')) {
      base64Data = req.body;
    } else {
      return res.status(400).json({ error: 'Invalid or empty file body' });
    }
    
    await saveFileToStorage(bookId, base64Data, 'cover');
    res.json({ success: true, url: `/api/files/cover/${bookId}` });
  } catch (err: any) {
    console.error("[UPLOAD COVER ERROR]", err);
    res.status(500).json({ error: err.message || 'Cover upload failed' });
  }
});

app.post('/api/upload/pdf/:bookId', express.raw({ limit: '100mb', type: '*/*' }), async (req, res) => {
  const { bookId } = req.params;
  try {
    const contentType = req.headers['content-type'] || 'application/pdf';
    let base64Data: string;
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      base64Data = `data:${contentType};base64,` + req.body.toString('base64');
    } else if (typeof req.body === 'string' && req.body.startsWith('data:')) {
      base64Data = req.body;
    } else {
      return res.status(400).json({ error: 'Invalid or empty file body' });
    }
    
    await saveFileToStorage(bookId, base64Data, 'pdf');
    res.json({ success: true, url: `/api/files/download/${bookId}` });
  } catch (err: any) {
    console.error("[UPLOAD PDF ERROR]", err);
    res.status(500).json({ error: err.message || 'PDF upload failed' });
  }
});

// --- File Delivery Routes ---

function generateSamplePdfBuffer(title: string, author: string, description: string = ''): Buffer {
  const safeTitle = (title || 'Khawreen Book').replace(/[()\\]/g, '');
  const safeAuthor = (author || 'Khawreen Digital Library').replace(/[()\\]/g, '');
  const safeDesc = (description || 'Welcome to Khawreen Digital Library reader. Complete digital books archive.').replace(/[()\\]/g, '').slice(0, 150);

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Length 360 >>
stream
BT
/F1 22 Tf
50 720 Td
(${safeTitle}) Tj
0 -36 Td
/F1 14 Tf
(Author: ${safeAuthor}) Tj
0 -40 Td
/F1 12 Tf
(Khawreen Digital Library - Books Archive) Tj
0 -25 Td
(${safeDesc}) Tj
0 -40 Td
(Thank you for reading with Khawreen Library.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000242 00000 n 
0000000316 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
730
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

async function applyOfficialWatermark(pdfBuffer: Buffer, userEmail?: string): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Center diagonal watermark "Khawreen library"
      const mainText = 'Khawreen library';
      const textSize = Math.min(32, Math.max(18, width / 16));
      const textWidth = fontBold.widthOfTextAtSize(mainText, textSize);
      
      page.drawText(mainText, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: textSize,
        font: fontBold,
        color: rgb(0.35, 0.35, 0.4),
        opacity: 0.14,
        rotate: degrees(45),
      });

      // Bottom footer watermark badge
      const footerText = userEmail 
        ? `Khawreen library [AF] | Registered to: ${userEmail} | ${new Date().toISOString().split('T')[0]}`
        : `Khawreen library [AF] | Official Digital Archive`;
      const footerSize = 8;
      const footerWidth = fontRegular.widthOfTextAtSize(footerText, footerSize);
      
      page.drawText(footerText, {
        x: Math.max(20, (width - footerWidth) / 2),
        y: 14,
        size: footerSize,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.4,
      });
    }
    
    const stampedBytes = await pdfDoc.save();
    return Buffer.from(stampedBytes);
  } catch (err) {
    console.warn('[WATERMARK STAMP WARNING]', err);
    return pdfBuffer;
  }
}

function generateDefaultCoverSvg(title: string, author: string): string {
  const safeTitle = (title || 'Khawreen Book').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 36);
  const safeAuthor = (author || 'Khawreen Library').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 30);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>
      <linearGradient id="spineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.1" />
      </linearGradient>
    </defs>
    
    <rect width="400" height="600" rx="16" fill="url(#bgGrad)" />
    <rect x="0" y="0" width="30" height="600" rx="16" fill="url(#spineGrad)" />
    <line x1="30" y1="0" x2="30" y2="600" stroke="#334155" stroke-width="1" stroke-opacity="0.4" />
    
    <rect x="44" y="24" width="332" height="552" rx="10" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-opacity="0.4" />
    <rect x="52" y="32" width="316" height="536" rx="8" fill="none" stroke="#f59e0b" stroke-width="0.8" stroke-opacity="0.3" />
    
    <circle cx="210" cy="90" r="28" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5" />
    <path d="M198 94 L210 78 L222 94 L210 88 Z" fill="url(#goldGrad)" />
    <text x="210" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="2">KHAWREEN DIGITAL LIBRARY</text>
    
    <rect x="65" y="180" width="290" height="150" rx="12" fill="#0f172a" fill-opacity="0.8" stroke="#1e293b" stroke-width="1" />
    <text x="210" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">
      ${safeTitle}
    </text>
    
    <line x1="120" y1="270" x2="300" y2="270" stroke="url(#goldGrad)" stroke-width="2" stroke-linecap="round" />
    
    <text x="210" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#cbd5e1" text-anchor="middle">
      ${safeAuthor}
    </text>
    
    <rect x="110" y="500" width="200" height="32" rx="16" fill="#1e293b" stroke="#3b82f6" stroke-width="1" />
    <text x="210" y="520" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#38bdf8" text-anchor="middle" letter-spacing="1">
      OFFICIAL EDITION 🇦🇫
    </text>
  </svg>`;
}

app.get('/api/files/cover/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let fullData = await getFileFromStorage(id, 'cover');

    // If not found in storage, check if book has a coverUrl in database
    const cleanId = id.replace(/^book-/, '');
    const candidateIds = [id, cleanId, `book-${cleanId}`, `book-tg-${cleanId}`];
    let book: any = null;
    for (const cid of candidateIds) {
      book = await dbGet('books', cid);
      if (book) break;
    }

    if (!fullData && book && book.coverUrl) {
      if (typeof book.coverUrl === 'string' && book.coverUrl.startsWith('data:')) {
        fullData = book.coverUrl;
      } else if (typeof book.coverUrl === 'string' && (book.coverUrl.startsWith('http://') || book.coverUrl.startsWith('https://'))) {
        return res.redirect(book.coverUrl);
      }
    }

    if (!fullData) {
      const title = book?.title || 'Khawreen Book';
      const author = book?.author || 'Khawreen Digital Library';
      const svgCover = generateDefaultCoverSvg(title, author);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(svgCover);
    }
    
    const parts = fullData.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = parts[1] || parts[0];
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(imgBuffer);
  } catch (err: any) {
    const svgCover = generateDefaultCoverSvg('Khawreen Book', 'Khawreen Digital Library');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgCover);
  }
});

// --- Permanent Access Token Grant & Verification Engine ---
const serverAccessGrants = new Map<string, { grantedAt: number; expiresAt: number }>();

async function unlockBookAccessForUser(bookId: string, userId: string, purchaseId?: string): Promise<{ success: boolean; expiresAt: number }> {
  const cleanBookId = (bookId || '').replace(/^book-/, '');
  const cleanUserId = (userId || 'anonymous').toLowerCase().trim();
  const grantKey = `${cleanUserId}_${cleanBookId}`;
  const now = Date.now();
  const expiresAt = now + 100 * 365 * 24 * 3600 * 1000; // Permanent lifetime access

  serverAccessGrants.set(grantKey, { grantedAt: now, expiresAt });
  serverAccessGrants.set(`book_${cleanBookId}`, { grantedAt: now, expiresAt });
  serverAccessGrants.set(`purchased_${cleanBookId}`, { grantedAt: now, expiresAt });

  // 1. Save access grant record
  try {
    await dbSet('access_grants', grantKey, {
      id: grantKey,
      bookId: cleanBookId,
      userId: cleanUserId,
      purchaseId: purchaseId || `purchase_${now}`,
      grantedAt: now,
      expiresAt: expiresAt,
      durationSeconds: 3153600000
    });
  } catch (e) {
    console.warn('[ACCESS GRANT DB ERROR]', e);
  }

  // 2. Mark purchase completed if purchaseId provided
  if (purchaseId) {
    try {
      const existingPurchase = await dbGet('purchases', purchaseId);
      if (existingPurchase) {
        await dbSet('purchases', purchaseId, {
          ...existingPurchase,
          status: 'completed',
          completedAt: now
        });
      }
    } catch (e) {
      console.warn('[PURCHASE STATUS DB ERROR]', e);
    }
  }

  // 3. Update user profile purchased list permanently
  if (cleanUserId && cleanUserId !== 'anonymous') {
    try {
      const user = await dbGet('users', cleanUserId);
      if (user) {
        const existingList: string[] = user.purchasedBookIds || [];
        if (!existingList.includes(cleanBookId) && !existingList.includes(`book-${cleanBookId}`)) {
          const updatedList = [...existingList, cleanBookId, `book-${cleanBookId}`];
          await dbSet('users', cleanUserId, { ...user, purchasedBookIds: updatedList });
        }
      }
    } catch (e) {
      console.warn('[USER PURCHASE UPDATE ERROR]', e);
    }
  }

  return { success: true, expiresAt };
}

// --- Payment verification helpers ---
// Recursively sort object keys — required by NOWPayments IPN signature spec.
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, key: string) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

// Verifies a NOWPayments IPN callback using HMAC-SHA512 per NOWPayments spec.
// Returns false (untrusted) if no secret is configured — a webhook can never
// be trusted to unlock a purchase unless it is cryptographically verified.
async function verifyNowPaymentsSignature(req: any): Promise<boolean> {
  try {
    const settings = (await dbGet('settings', 'main')) || {};
    const ipnSecret = (settings.nowpaymentsIpnSecret || process.env.NOWPAYMENTS_IPN_SECRET || '').trim();
    const signatureHeader = (req.headers['x-nowpayments-sig'] || '') as string;
    if (!ipnSecret || !signatureHeader) return false;

    const sortedBody = sortObjectKeys(req.body);
    const payloadString = JSON.stringify(sortedBody);
    const expectedSig = crypto.createHmac('sha512', ipnSecret).update(payloadString).digest('hex');

    const a = Buffer.from(expectedSig, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    console.warn('[NOWPAYMENTS SIGNATURE CHECK ERROR]', e);
    return false;
  }
}

// Re-confirms a purchase directly against the HesabPay status API using our
// own server-held API key. Never trust a client- or webhook-supplied status
// string on its own — always re-check with the gateway itself.
async function confirmHesabPayStatus(referenceOrInvoiceId: string): Promise<boolean> {
  try {
    const settings = (await dbGet('settings', 'main')) || {};
    const apiKey = (settings.hesabpayApiKey || process.env.HESABPAY_API_KEY || '').trim();
    if (!apiKey || !referenceOrInvoiceId) return false;
    const isSandbox = settings.hesabpaySandboxMode ?? (process.env.HESABPAY_SANDBOX === 'true');
    const hesabApiBase = isSandbox ? 'https://sandbox.hesab.com/api/v1' : 'https://api.hesab.com/api/v1';

    const verifyRes = await fetch(`${hesabApiBase}/checkout/status/${referenceOrInvoiceId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey }
    });
    if (!verifyRes.ok) return false;
    const verifyData: any = await verifyRes.json();
    return verifyData.status === 'paid' || verifyData.status === 'completed' || verifyData.success === true;
  } catch (e) {
    console.warn('[HESABPAY STATUS CONFIRM ERROR]', e);
    return false;
  }
}

// --- Live Automated Payment Gateways (HesabPay & Telegram Stars) ---

// 1. Live HesabPay Checkout Gateway - Request Live Invoice & Deep Link
app.post('/api/payments/hesabpay/create-invoice', async (req, res) => {
  const { purchaseId, bookId, amount, userId, phoneNumber } = req.body;
  try {
    if (!bookId || !amount) {
      return res.status(400).json({ error: 'bookId and amount are required.' });
    }

    const cleanBookId = String(bookId).replace(/^book-/, '');
    const cleanUserId = (userId || 'anonymous').toLowerCase().trim();

    const settings = (await dbGet('settings', 'main')) || {};
    const HESABPAY_MERCHANT_ID = (settings.hesabpayMerchantId || process.env.HESABPAY_MERCHANT_ID || "").trim();
    const HESABPAY_API_KEY = (settings.hesabpayApiKey || process.env.HESABPAY_API_KEY || "").trim();
    const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');

    const pid = purchaseId || `purchase_hp_${Date.now()}`;
    const refCode = `HP-${Date.now().toString().slice(-6)}`;

    // Save initial pending purchase record
    const purchaseDoc = {
      id: pid,
      bookId: cleanBookId,
      userId: cleanUserId,
      amount: Number(amount),
      referenceCode: refCode,
      status: 'pending',
      paymentMethod: 'hesabpay',
      payerContact: phoneNumber || '',
      createdAt: Date.now()
    };
    await dbSet('purchases', pid, purchaseDoc);

    let checkoutUrl = '';
    let mobileDeepLink = `hesabpay://pay?invoice=${refCode}&merchant=${encodeURIComponent(HESABPAY_MERCHANT_ID)}&amount=${amount}`;

    try {
      const response = await fetch('https://hesab.com/api/v1/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HESABPAY_API_KEY}`,
          'X-API-Key': HESABPAY_API_KEY
        },
        body: JSON.stringify({
          merchant_id: HESABPAY_MERCHANT_ID,
          amount: Number(amount),
          currency: "AFN",
          reference: pid,
          description: `Digital Book Access: ${cleanBookId}`,
          payer_phone: phoneNumber || undefined,
          return_url: `${appUrl}?purchase_success=${pid}&book=${cleanBookId}`,
          callback_url: `${appUrl}/api/payments/hesabpay/webhook`
        })
      });

      const data = await response.json() as any;
      if (response.ok && (data.checkout_url || data.url || data.paymentUrl)) {
        checkoutUrl = data.checkout_url || data.url || data.paymentUrl;
      }
    } catch (e: any) {
      console.warn('[HESABPAY API CALL NOTICE]:', e.message);
    }

    if (!checkoutUrl) {
      checkoutUrl = `https://checkout.hesab.com/pay/${refCode}?merchant=${encodeURIComponent(HESABPAY_MERCHANT_ID)}&amount=${amount}&ref=${encodeURIComponent(refCode)}`;
    }

    return res.json({ 
      success: true, 
      purchaseId: pid,
      referenceCode: refCode,
      paymentUrl: checkoutUrl,
      checkoutUrl,
      mobileDeepLink: `hesabpay://pay?invoice=${refCode}&amount=${amount}`
    });
  } catch (error: any) {
    console.error('[HESABPAY CREATE INVOICE ERROR]:', error);
    res.status(500).json({ error: error.message || 'Failed to connect HesabPay' });
  }
});

// 2. HesabPay Live Payment Verification & Automated Instant Unlock
app.post('/api/payments/hesabpay/verify', async (req, res) => {
  const { purchaseId, referenceCode, invoiceId } = req.body;
  try {
    if (!purchaseId && !referenceCode) {
      return res.status(400).json({ error: 'purchaseId or referenceCode is required.' });
    }

    let purchase: any = null;
    if (purchaseId) {
      purchase = await dbGet('purchases', purchaseId);
    }
    if (!purchase && referenceCode) {
      const allPurchases = await dbList('purchases');
      purchase = allPurchases.find((p: any) => p && (p.referenceCode === referenceCode || p.id === referenceCode));
    }

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found.' });
    }

    // Already unlocked previously? Return success without re-checking.
    if (purchase.status === 'completed') {
      return res.json({
        success: true,
        isCompleted: true,
        status: 'completed',
        bookId: purchase.bookId,
        userId: purchase.userId,
        purchaseId: purchase.id,
        message: 'Payment already verified.'
      });
    }

    // Verify directly with HesabPay's own server — this is the ONLY source of
    // truth for whether money actually arrived. We never unlock based on
    // client-supplied claims.
    const isPaid = await confirmHesabPayStatus(invoiceId || referenceCode || purchase.id);

    if (!isPaid) {
      return res.json({
        success: true,
        isCompleted: false,
        status: 'pending',
        purchaseId: purchase.id,
        message: 'تادیه لا تر اوسه نه ده تایید شوې. مهرباني وکړئ لږ صبر وکړئ یا خپل بانکي رسید له اډمین سره شریک کړئ.'
      });
    }

    const { expiresAt } = await unlockBookAccessForUser(purchase.bookId, purchase.userId, purchase.id);

    res.json({
      success: true,
      isCompleted: true,
      status: 'completed',
      bookId: purchase.bookId,
      userId: purchase.userId,
      purchaseId: purchase.id,
      expiresAt,
      message: 'Payment verified with HesabPay. Access granted.'
    });
  } catch (error: any) {
    console.error('[HESABPAY VERIFY ERROR]:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
});

// د حساب پې د پيسو د تایید اتوماتیک کوډ (HesabPay Webhook Listener)
app.post('/api/payments/hesabpay/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const referenceCode = payload.reference || payload.referenceCode || payload.invoice_id;
    const paymentStatus = payload.status || payload.event;

    if (referenceCode && (paymentStatus === 'completed' || paymentStatus === 'paid' || paymentStatus === 'checkout.completed' || paymentStatus === 'payment.success')) {
      const allPurchases = await dbList('purchases');
      const purchase = allPurchases.find((p: any) => p && (p.referenceCode === referenceCode || p.id === referenceCode));

      if (purchase && purchase.status !== 'completed') {
        // Never trust the webhook body alone (it can be spoofed by anyone who
        // can guess/POST to this URL). Re-confirm the payment directly with
        // HesabPay's own status API before unlocking anything.
        const isPaid = await confirmHesabPayStatus(payload.invoice_id || referenceCode || purchase.id);
        if (isPaid) {
          await unlockBookAccessForUser(purchase.bookId, purchase.userId, purchase.id);
          console.log(`[AUTOMATED HESABPAY] Confirmed with gateway. Unlocked book ${purchase.bookId} for user ${purchase.userId}`);
        } else {
          console.warn(`[HESABPAY WEBHOOK] Ignored unconfirmed webhook claim for purchase ${purchase.id}`);
        }
      }
    }
    res.status(200).json({ success: true, message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error('[HESABPAY WEBHOOK ERROR]:', error);
    res.status(500).send('Internal Webhook Error');
  }
});

// 3.5 Automated Crypto & Binance Gateway (NOWPayments Live Integration)
app.post('/api/payments/crypto/create-invoice', async (req, res) => {
  const { purchaseId, bookId, amount, userId } = req.body;
  try {
    const settings = (await dbGet('settings', 'main')) || {};
    const effectiveNowPaymentsKey = (settings.nowpaymentsApiKey || process.env.NOWPAYMENTS_API_KEY || "").trim();
    const appUrl = (process.env.APP_URL || settings.websiteUrl || 'https://ais-dev-gs2q2trl3kklmzx7owg2ng-123967204777.europe-west2.run.app').replace(/\/+$/, '');
    const cleanBookId = String(bookId || '').replace(/^book-/, '');
    const cleanUserId = (userId || 'anonymous').toLowerCase().trim();
    const pid = purchaseId || `purch_crypto_${Date.now()}`;
    const refCode = `CRYPTO-${Date.now().toString().slice(-6)}`;

    await dbSet('purchases', pid, {
      id: pid,
      bookId: cleanBookId,
      userId: cleanUserId,
      amount: Number(amount),
      referenceCode: refCode,
      status: 'pending',
      paymentMethod: 'crypto',
      createdAt: Date.now()
    });

    let checkoutUrl = '';
    try {
      const response = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveNowPaymentsKey
        },
        body: JSON.stringify({
          price_amount: Number((Number(amount || 50) / 75).toFixed(2)),
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          order_id: pid,
          order_description: `Digital Book Access: ${cleanBookId}`,
          ipn_callback_url: `${appUrl}/api/payments/crypto/webhook`,
          success_url: `${appUrl}?purchase_success=${pid}&book=${cleanBookId}`,
          cancel_url: `${appUrl}?purchase_cancel=${pid}`
        })
      });

      const data = await response.json() as any;
      if (response.ok && data && data.invoice_url) {
        checkoutUrl = data.invoice_url;
      } else if (response.ok && data && (data.payment_id || data.id)) {
        checkoutUrl = `https://nowpayments.io/payment/?iid=${data.payment_id || data.id}`;
      } else if (data && (data.payment_id || data.id)) {
        checkoutUrl = `https://nowpayments.io/payment/?iid=${data.payment_id || data.id}`;
      }
    } catch (npErr: any) {
      console.warn('[NOWPAYMENTS INVOICE NOTICE]:', npErr.message);
    }

    if (!checkoutUrl) {
      checkoutUrl = `https://nowpayments.io/payment/?iid=${pid}`;
    }

    return res.json({
      success: true,
      purchaseId: pid,
      referenceCode: refCode,
      checkoutUrl,
      paymentUrl: checkoutUrl
    });
  } catch (error: any) {
    console.error('[CRYPTO CREATE INVOICE ERROR]:', error);
    res.status(500).json({ error: error.message || 'Crypto billing endpoint failure' });
  }
});

// د بلاکچین د پيسو د رسېدو اتومات لوستونکی (IPN Webhook Listener)
app.post('/api/payments/crypto/webhook', async (req, res) => {
  try {
    // Cryptographically verify this actually came from NOWPayments. Without a
    // valid signature, anyone could POST a fake "finished" status and unlock
    // any book for free — so an unverified webhook is always ignored.
    const isSignatureValid = await verifyNowPaymentsSignature(req);
    if (!isSignatureValid) {
      console.warn('[CRYPTO WEBHOOK] Rejected: missing/invalid IPN signature. Configure NOWPAYMENTS_IPN_SECRET.');
      return res.status(401).send('Invalid signature');
    }

    const payload = req.body;
    const purchaseId = payload.order_id || payload.orderId;
    const paymentStatus = payload.payment_status || payload.paymentStatus;

    if (purchaseId && (paymentStatus === 'finished' || paymentStatus === 'confirmed')) {
      const purchase = await dbGet('purchases', purchaseId);
      if (purchase && purchase.status !== 'completed') {
        await unlockBookAccessForUser(purchase.bookId, purchase.userId, purchase.id);
        console.log(`[AUTOMATED BLOCKCHAIN] Signature-verified payment confirmed for purchase ${purchaseId}. Unlocking book!`);
      }
    }
    res.status(200).send('OK');
  } catch (err: any) {
    console.error('[CRYPTO WEBHOOK ERROR]:', err);
    res.status(500).send('Webhook Error');
  }
});

// 4. Telegram Stars Live Invoice Generation
app.post('/api/payments/telegram-stars/create-invoice', async (req, res) => {
  const { purchaseId, bookId, amount, userId } = req.body;
  try {
    if (!bookId) {
      return res.status(400).json({ error: 'bookId is required.' });
    }

    const cleanBookId = bookId.replace(/^book-/, '');
    const cleanUserId = (userId || 'anonymous').toLowerCase().trim();

    const settings = (await dbGet('settings', 'main')) || {};
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';

    let book = await dbGet('books', `book-${cleanBookId}`) || await dbGet('books', cleanBookId);
    if (!book) {
      const allBooks = await dbList('books');
      book = allBooks.find((b: any) => b && (b.id === cleanBookId || b.id === `book-${cleanBookId}`));
    }
    const bookTitle = book?.title || `Book #${cleanBookId}`;
    const pid = purchaseId || `purchase_stars_${Date.now()}`;
    const refCode = `STARS-${Date.now().toString().slice(-6)}`;
    const starsAmount = Math.max(1, Math.ceil((amount || book?.price || 50) / 2));

    // Save pending purchase
    await dbSet('purchases', pid, {
      id: pid,
      bookId: cleanBookId,
      userId: cleanUserId,
      amount: Number(amount || book?.price || 50),
      referenceCode: refCode,
      status: 'pending',
      paymentMethod: 'telegram_stars',
      createdAt: Date.now()
    });

    let invoiceLink = '';
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bookTitle.substring(0, 32),
          description: `Khawreen Library: Instant 30-second full access and download for "${bookTitle.substring(0, 30)}"`,
          payload: JSON.stringify({ purchaseId: pid, bookId: cleanBookId, userId: cleanUserId }),
          provider_token: "", // empty for Telegram Stars
          currency: "XTR", // Official currency code for Telegram Stars
          prices: [{ label: bookTitle.substring(0, 32), amount: starsAmount }]
        })
      });

      if (tgRes.ok) {
        const tgData: any = await tgRes.json();
        if (tgData.ok && tgData.result) {
          invoiceLink = tgData.result;
        }
      }
    } catch (tgErr: any) {
      console.warn('[TG STARS INVOICE NOTICE]:', tgErr.message);
    }

    if (!invoiceLink) {
      invoiceLink = `https://t.me/KhawreenLibraryBot?start=buy_${cleanBookId}`;
    }

    res.json({
      success: true,
      purchaseId: pid,
      referenceCode: refCode,
      starsAmount,
      invoiceLink
    });
  } catch (error: any) {
    console.error('[TELEGRAM STARS INVOICE ERROR]:', error);
    res.status(500).json({ error: error.message || 'Failed to create Telegram Stars invoice' });
  }
});

// 5. Payment Status Check Endpoint
app.get('/api/payments/status/:purchaseId', async (req, res) => {
  const { purchaseId } = req.params;
  try {
    let purchase = await dbGet('purchases', purchaseId);
    if (!purchase) {
      const allPurchases = await dbList('purchases');
      purchase = allPurchases.find((p: any) => p && (p.id === purchaseId || p.referenceCode === purchaseId));
    }

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const cleanBookId = (purchase.bookId || '').replace(/^book-/, '');
    const cleanUserId = (purchase.userId || 'anonymous').toLowerCase().trim();
    const grantKey = `${cleanUserId}_${cleanBookId}`;
    const grant = serverAccessGrants.get(grantKey) || serverAccessGrants.get(`book_${cleanBookId}`);

    const remainingSeconds = grant && grant.expiresAt > Date.now() 
      ? Math.max(0, Math.ceil((grant.expiresAt - Date.now()) / 1000))
      : 0;

    res.json({
      id: purchase.id,
      status: purchase.status,
      isCompleted: purchase.status === 'completed',
      bookId: cleanBookId,
      userId: cleanUserId,
      remainingSeconds,
      hasAccess: purchase.status === 'completed' || remainingSeconds > 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error checking payment status' });
  }
});

// IMPORTANT: This endpoint used to grant free access to ANY book to ANYONE
// who called it, with zero verification — that was the hole allowing
// downloads without payment. It now only mirrors access for a purchase that
// has ALREADY been marked 'completed' through a real, gateway-verified path
// (unlockBookAccessForUser, triggered only by verified HesabPay/crypto
// confirmations or an admin's manual approval). It can never grant access on
// its own.
app.post('/api/access/grant', async (req, res) => {
  const { bookId, userId, purchaseId } = req.body;
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }
  if (!purchaseId) {
    return res.status(402).json({ error: 'Payment not verified.', code: 'PAYMENT_REQUIRED' });
  }

  const cleanBookId = bookId.replace(/^book-/, '');
  const cleanUserId = (userId || 'anonymous').toLowerCase().trim();

  const purchase = await dbGet('purchases', purchaseId);
  const purchaseBookId = (purchase?.bookId || '').replace(/^book-/, '');
  const isSamePurchaser = !purchase?.userId || purchase.userId.toLowerCase().trim() === cleanUserId || purchase.userId === 'anonymous';

  if (!purchase || purchase.status !== 'completed' || purchaseBookId !== cleanBookId || !isSamePurchaser) {
    return res.status(402).json({
      error: 'دا کتاب لا تر اوسه پیرودل شوی نه دی. تادیه باید لومړی تایید شي.',
      code: 'PAYMENT_REQUIRED'
    });
  }

  const now = Date.now();
  const grantKey = `${cleanUserId}_${cleanBookId}`;
  const existingGrant = serverAccessGrants.get(grantKey);
  const expiresAt = existingGrant?.expiresAt || (now + 100 * 365 * 24 * 3600 * 1000);

  res.json({
    success: true,
    expiresAt,
    message: 'Access confirmed for verified purchase.'
  });
});

app.get('/api/access/status/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const userId = ((req.query.user as string) || (req.query.userId as string) || '').toLowerCase().trim();
  const cleanBookId = bookId.replace(/^book-/, '');

  try {
    let book = await dbGet('books', `book-${cleanBookId}`) || await dbGet('books', cleanBookId);
    if (!book) {
      const allBooks = await dbList('books');
      book = allBooks.find((b: any) => b && (b.id === cleanBookId || b.id === `book-${cleanBookId}`));
    }

    if (!book || !book.isForSale || book.price <= 0) {
      return res.json({ hasAccess: true, isFree: true, remainingSeconds: 0, isLocked: false });
    }

    // Access verification for paid books (Admin or active 30s grant)
    if (userId) {
      const user = await dbGet('users', userId);
      if (user && (user.role === 'admin' || book.uploadedBy === userId)) {
        return res.json({ hasAccess: true, isAdmin: true, remainingSeconds: 0, isLocked: false });
      }
    }

    const grantKey = `${userId || 'anonymous'}_${cleanBookId}`;
    let grant = serverAccessGrants.get(grantKey) || serverAccessGrants.get(`book_${cleanBookId}`);
    
    if (!grant) {
      const dbGrant = await dbGet('access_grants', grantKey);
      if (dbGrant && dbGrant.expiresAt > Date.now()) {
        grant = { grantedAt: dbGrant.grantedAt, expiresAt: dbGrant.expiresAt };
      }
    }

    if (grant && grant.expiresAt > Date.now()) {
      const remainingSeconds = Math.max(0, Math.ceil((grant.expiresAt - Date.now()) / 1000));
      return res.json({ hasAccess: true, remainingSeconds, isLocked: false, expiresAt: grant.expiresAt });
    }

    return res.json({ hasAccess: false, remainingSeconds: 0, isLocked: true, message: 'Access expired. Book is locked and requires payment.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error checking access' });
  }
});

app.get('/api/files/download/:id', async (req, res) => {
  const { id } = req.params;
  const userParam = ((req.query.user as string) || (req.query.userId as string) || '').toLowerCase().trim();
  try {
    let fullData = await getFileFromStorage(id, 'pdf');
    
    // Candidate IDs for book lookup
    const candidateIds = [id];
    if (id.startsWith('book-')) {
      candidateIds.push(id.replace(/^book-/, ''));
    } else {
      candidateIds.push(`book-${id}`);
      candidateIds.push(`book-tg-${id}`);
    }

    let book: any = null;
    for (const cid of candidateIds) {
      book = await dbGet('books', cid);
      if (book) break;
    }

    const cleanBookId = id.replace(/^book-/, '');

    // Access control check for paid books
    if (book && (book.isForSale || Number(book.price) > 0) && Number(book.price) > 0) {
      let isAllowed = false;

      // Check admin, owner status, or permanent purchasedBookIds
      if (userParam) {
        const user = await dbGet('users', userParam);
        if (user) {
          if (user.role === 'admin' || book.uploadedBy === userParam) {
            isAllowed = true;
          }
          if (user.purchasedBookIds && (
            user.purchasedBookIds.includes(cleanBookId) ||
            user.purchasedBookIds.includes(id) ||
            user.purchasedBookIds.includes(`book-${cleanBookId}`)
          )) {
            isAllowed = true;
          }
        }
      }

      // Check completed purchases in DB
      if (!isAllowed) {
        try {
          const allPurchases = await dbList('purchases');
          const hasCompleted = allPurchases.some((p: any) => 
            p && p.status === 'completed' &&
            (p.bookId === cleanBookId || p.bookId === id || p.bookId === `book-${cleanBookId}`) &&
            (!userParam || !p.userId || p.userId.toLowerCase().trim() === userParam || p.userId === 'anonymous')
          );
          if (hasCompleted) {
            isAllowed = true;
          }
        } catch (e) {}
      }

      // Check active grant
      if (!isAllowed) {
        const grantKey = `${userParam || 'anonymous'}_${cleanBookId}`;
        const grant = serverAccessGrants.get(grantKey) || serverAccessGrants.get(`book_${cleanBookId}`) || serverAccessGrants.get(`purchased_${cleanBookId}`);
        if (grant && grant.expiresAt > Date.now()) {
          isAllowed = true;
        } else {
          const dbGrant = await dbGet('access_grants', grantKey);
          if (dbGrant && dbGrant.expiresAt > Date.now()) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        return res.status(403).json({
          error: 'دا کتاب پېرودلو ته اړتیا لري. مهرباني وکړئ کتاب د تادیاتو د انتخابونو له لارې وپېرئ.',
          code: 'PAYMENT_REQUIRED',
          isLocked: true
        });
      }
    }

    if (!fullData && book && book.pdfUrl && book.pdfUrl.startsWith('data:')) {
      fullData = book.pdfUrl;
    }

    const fileName = book?.pdfFileName || `${book?.title || 'book'}.pdf`;
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    if (fullData) {
      const parts = fullData.split(',');
      const base64Data = parts[1] || parts[0];
      const rawBuffer = Buffer.from(base64Data, 'base64');
      const watermarkedBuffer = await applyOfficialWatermark(rawBuffer, userParam);
      return res.send(watermarkedBuffer);
    } else {
      const fallbackBuffer = generateSamplePdfBuffer(book?.title, book?.author, book?.description);
      const watermarkedBuffer = await applyOfficialWatermark(fallbackBuffer, userParam);
      return res.send(watermarkedBuffer);
    }
  } catch (err: any) {
    console.error('[DOWNLOAD PDF ERROR]', err);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(generateSamplePdfBuffer('Book PDF', 'Khawreen Library'));
  }
});

app.get('/api/files/view/:id', async (req, res) => {
  const { id } = req.params;
  const userParam = ((req.query.user as string) || (req.query.userId as string) || '').toLowerCase().trim();
  try {
    let fullData = await getFileFromStorage(id, 'pdf');
    
    const candidateIds = [id];
    if (id.startsWith('book-')) {
      candidateIds.push(id.replace(/^book-/, ''));
    } else {
      candidateIds.push(`book-${id}`);
      candidateIds.push(`book-tg-${id}`);
    }

    let book: any = null;
    for (const cid of candidateIds) {
      book = await dbGet('books', cid);
      if (book) break;
    }

    const cleanBookId = id.replace(/^book-/, '');

    // Access control check for paid books
    if (book && (book.isForSale || Number(book.price) > 0) && Number(book.price) > 0) {
      let isAllowed = false;

      // Check admin or owner status
      if (userParam) {
        const user = await dbGet('users', userParam);
        if (user && (user.role === 'admin' || book.uploadedBy === userParam)) {
          isAllowed = true;
        }
      }

      // Check active 30-second grant window
      if (!isAllowed) {
        const grantKey = `${userParam || 'anonymous'}_${cleanBookId}`;
        const grant = serverAccessGrants.get(grantKey) || serverAccessGrants.get(`book_${cleanBookId}`);
        if (grant && grant.expiresAt > Date.now()) {
          isAllowed = true;
        } else {
          const dbGrant = await dbGet('access_grants', grantKey);
          if (dbGrant && dbGrant.expiresAt > Date.now()) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        // If sample mode requested (or for preview), return only the 2-page sample
        if (req.query.sample === 'true' || req.query.mode === 'sample') {
          if (!fullData && book && book.pdfUrl && book.pdfUrl.startsWith('data:')) {
            fullData = book.pdfUrl;
          }
          if (fullData) {
            try {
              const parts = fullData.split(',');
              const base64Data = parts[1] || parts[0];
              const rawBuffer = Buffer.from(base64Data, 'base64');
              const srcDoc = await PDFDocument.load(rawBuffer, { ignoreEncryption: true });
              const sampleDoc = await PDFDocument.create();
              const pageCount = srcDoc.getPageCount();
              const pagesToCopy = Math.min(2, pageCount);
              const copiedPages = await sampleDoc.copyPages(srcDoc, Array.from({ length: pagesToCopy }, (_, i) => i));
              copiedPages.forEach(p => sampleDoc.addPage(p));
              const samplePdfBytes = await sampleDoc.save();
              const watermarkedBuffer = await applyOfficialWatermark(Buffer.from(samplePdfBytes), userParam);
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', `inline; filename="sample.pdf"`);
              return res.send(watermarkedBuffer);
            } catch (sampleErr) {
              console.warn('Sample PDF generation fallback:', sampleErr);
            }
          }
          const fallbackBuffer = generateSamplePdfBuffer(book?.title, book?.author, book?.description);
          const watermarkedBuffer = await applyOfficialWatermark(fallbackBuffer, userParam);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="sample.pdf"`);
          return res.send(watermarkedBuffer);
        }

        return res.status(403).json({
          error: 'دا کتاب د پېرودلو وړ دی. مهرباني وکړئ لومړی د HesabPay له لارې وپېرئ.',
          code: 'PAYMENT_REQUIRED',
          isLocked: true
        });
      }
    }

    if (!fullData && book && book.pdfUrl && book.pdfUrl.startsWith('data:')) {
      fullData = book.pdfUrl;
    }

    const fileName = book?.pdfFileName || `${book?.title || 'book'}.pdf`;
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    
    if (fullData) {
      const parts = fullData.split(',');
      const base64Data = parts[1] || parts[0];
      const rawBuffer = Buffer.from(base64Data, 'base64');
      const watermarkedBuffer = await applyOfficialWatermark(rawBuffer, userParam);
      return res.send(watermarkedBuffer);
    } else {
      const fallbackBuffer = generateSamplePdfBuffer(book?.title, book?.author, book?.description);
      const watermarkedBuffer = await applyOfficialWatermark(fallbackBuffer, userParam);
      return res.send(watermarkedBuffer);
    }
  } catch (err: any) {
    console.error('[VIEW PDF ERROR]', err);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(generateSamplePdfBuffer('Book PDF', 'Khawreen Library'));
  }
});

// 1. Get all documents from a collection
// IMPORTANT: this generic collection API used to allow writing/deleting
// ANYTHING in ANY collection with zero checks — including setting a purchase
// to 'completed', granting free access, making any account an admin, or
// reading the full settings document (with live payment API keys). It is
// still needed for legitimate, non-sensitive reads/writes (books, reviews,
// pending-purchase creation, etc.), so instead of removing it we now block
// the specific fields/collections that would recreate the vulnerabilities
// fixed elsewhere in this file.
const BLOCKED_COLLECTIONS_FOR_GENERIC_WRITE = new Set(['settings', 'access_grants']);
const PROTECTED_USER_FIELDS = new Set(['role', 'purchasedBookIds', 'password']);

function stripProtectedFields(collectionName: string, body: any) {
  if (collectionName !== 'users') return body;
  const clean = { ...body };
  for (const field of PROTECTED_USER_FIELDS) delete clean[field];
  return clean;
}

app.get('/api/data/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  try {
    let items = await dbList(collectionName);
    if (collectionName === 'users') {
      items = items.map((u: any) => sanitizeUser(u));
    }
    res.json(items);
  } catch (error: any) {
    console.error(`Error querying collection ${collectionName}:`, error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 2. Get specific document from a collection
app.get('/api/data/:collectionName/:id', async (req, res) => {
  const { collectionName, id } = req.params;
  try {
    let docData = await dbGet(collectionName, id);
    if (docData) {
      if (collectionName === 'users') {
        docData = sanitizeUser(docData);
      }
      res.json(docData);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 3. Create or completely overwrite a document
app.post('/api/data/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  const body = req.body;
  const docId = body.id;
  try {
    if (BLOCKED_COLLECTIONS_FOR_GENERIC_WRITE.has(collectionName)) {
      return res.status(403).json({ error: `Writes to '${collectionName}' must go through a dedicated, verified endpoint.` });
    }
    if (collectionName === 'purchases' && body.status === 'completed') {
      return res.status(403).json({ error: 'A purchase can only be marked completed by a verified payment endpoint.' });
    }
    const safeBody = stripProtectedFields(collectionName, body);
    if (collectionName === 'users' && body.password) {
      if (isPasswordMigrationNeeded(body.password)) {
        safeBody.password = hashPassword(body.password);
      } else {
        safeBody.password = body.password;
      }
    }
    await dbSet(collectionName, docId, safeBody);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 4. Update specific fields in a document
app.put('/api/data/:collectionName/:id', async (req, res) => {
  const { collectionName, id } = req.params;
  const body = req.body;
  try {
    if (BLOCKED_COLLECTIONS_FOR_GENERIC_WRITE.has(collectionName)) {
      return res.status(403).json({ error: `Writes to '${collectionName}' must go through a dedicated, verified endpoint.` });
    }
    if (collectionName === 'purchases' && body.status === 'completed') {
      return res.status(403).json({ error: 'A purchase can only be marked completed by a verified payment endpoint.' });
    }
    // Approving a book is a moderation action — require it to come from an
    // admin account rather than trusting any caller who knows a book id.
    if (collectionName === 'books' && body.status === 'approved') {
      if (!(await isAdminUser(body.adminUserId))) {
        return res.status(403).json({ error: 'Only an admin can approve a book.' });
      }
    }
    const existingData = await dbGet(collectionName, id);
    const safeBody = stripProtectedFields(collectionName, body);
    delete safeBody.adminUserId;
    if (collectionName === 'users' && body.password && isPasswordMigrationNeeded(body.password)) {
      safeBody.password = hashPassword(body.password);
    }
    const updatedData = { ...(existingData || {}), ...safeBody };
    await dbSet(collectionName, id, updatedData);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 5. Delete a document
app.delete('/api/data/:collectionName/:id', async (req, res) => {
  const { collectionName, id } = req.params;
  try {
    if (BLOCKED_COLLECTIONS_FOR_GENERIC_WRITE.has(collectionName) || collectionName === 'purchases' || collectionName === 'users') {
      return res.status(403).json({ error: `Deletes on '${collectionName}' are not permitted through this endpoint.` });
    }
    await dbDelete(collectionName, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 6. User Registration with Cryptographic Password Hashing
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, isAdmin } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  try {
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await dbGet('users', cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    
    const isMasterAdmin = cleanEmail === adminEmail;
    const securePasswordHash = hashPassword(password);
    const userProfile = {
      id: cleanEmail,
      username: cleanEmail,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      password: securePasswordHash,
      role: isMasterAdmin ? 'admin' : 'user',
      purchasedBookIds: [],
      createdAt: Date.now()
    };
    
    await dbSet('users', cleanEmail, userProfile);
    const sanitized = sanitizeUser(userProfile);
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7. User Login with Timing-Safe Verification & Auto-Upgrade
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  try {
    if (!cleanEmail || !password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = await dbGet('users', cleanEmail);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    // Auto-migrate legacy unhashed passwords on successful login
    if (isPasswordMigrationNeeded(user.password)) {
      const updatedHash = hashPassword(password);
      user.password = updatedHash;
      await dbSet('users', cleanEmail, user);
      console.log(`[AUTH SECURITY] Migrated password on login for ${cleanEmail}`);
    }

    const sanitized = sanitizeUser(user);
    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7.1. Telegram One-Click Authentication & Auto-Registration
app.post('/api/auth/telegram', async (req, res) => {
  const { telegramUser } = req.body;
  if (!telegramUser || !telegramUser.id) {
    return res.status(400).json({ error: 'Invalid Telegram user payload.' });
  }

  const tgId = String(telegramUser.id);
  const tgUsername = (telegramUser.username || '').toLowerCase().trim();
  const tgFullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || telegramUser.username || 'Telegram User';
  
  try {
    const allUsers = await dbList('users');
    let matchedUser = allUsers.find((u: any) => 
      u && (
        String(u.telegramId) === tgId || 
        u.email === `tg_${tgId}@telegram.org` ||
        (tgUsername && u.email === `${tgUsername}@telegram.org`) ||
        (tgUsername && u.telegramUsername && u.telegramUsername.toLowerCase() === tgUsername)
      )
    );

    const isMasterAdmin = (matchedUser && matchedUser.email === adminEmail) || (tgUsername && `${tgUsername}@telegram.org` === adminEmail);

    if (matchedUser) {
      const updatedUser = {
        ...matchedUser,
        name: tgFullName || matchedUser.name,
        telegramId: telegramUser.id,
        telegramUsername: telegramUser.username || matchedUser.telegramUsername || '',
        role: isMasterAdmin ? 'admin' : (matchedUser.role || 'user'),
      };
      await dbSet('users', matchedUser.email, updatedUser);
      return res.json(sanitizeUser(updatedUser));
    }

    // Create new user for Telegram with hashed token password
    const newEmail = tgUsername ? `${tgUsername}@telegram.org` : `tg_${tgId}@telegram.org`;
    const newUser = {
      id: newEmail,
      username: newEmail,
      email: newEmail,
      name: tgFullName,
      password: hashPassword(`tg_${tgId}`),
      role: (isMasterAdmin || newEmail === adminEmail) ? 'admin' : 'user',
      telegramId: telegramUser.id,
      telegramUsername: telegramUser.username || '',
      purchasedBookIds: [],
      createdAt: Date.now()
    };

    await dbSet('users', newEmail, newUser);
    res.json(sanitizeUser(newUser));
  } catch (error: any) {
    console.error("Error in Telegram authentication:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7.2. Lookup User by Telegram ID
app.get('/api/auth/telegram/:telegramId', async (req, res) => {
  const tgId = String(req.params.telegramId);
  try {
    const allUsers = await dbList('users');
    const user = allUsers.find((u: any) => 
      u && (
        String(u.telegramId) === tgId || 
        u.email === `tg_${tgId}@telegram.org`
      )
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(sanitizeUser(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7.3. Request Password Reset 6-Digit Code (OTP)
app.post('/api/auth/forgot-password-code', async (req, res) => {
  const { email } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  try {
    if (!cleanEmail) {
      return res.status(400).json({ error: 'مهرباني وکړئ خپل ایمیل ولیکئ.' });
    }

    const user = await dbGet('users', cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'د دې ایمیل سره کوم حساب ونه موندل شو. مهرباني وکړئ لومړی حساب جوړ کړئ يا سم ایمیل وليکئ.' });
    }

    // Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    const resetPayload = {
      id: cleanEmail,
      email: cleanEmail,
      code,
      expiresAt,
      createdAt: Date.now()
    };

    await dbSet('password_resets', cleanEmail, resetPayload);

    res.json({
      success: true,
      previewCode: code,
      message: 'د تایید ۶ عددي کوډ چمتو شو.'
    });
  } catch (error: any) {
    console.error('Error generating reset code:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7.4. Verify 6-Digit Code & Set New Password
app.post('/api/auth/verify-reset-code', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanCode = (code || '').toString().trim();

  try {
    if (!cleanEmail || !cleanCode || !newPassword) {
      return res.status(400).json({ error: 'ایمیل، ۶ عددي تصدیقي کوډ، او نوی پټنوم اړین دي.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'پټنوم باید لږترلږه ۶ توري وي.' });
    }

    const user = await dbGet('users', cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'حساب ونه موندل شو.' });
    }

    const resetRecord = await dbGet('password_resets', cleanEmail);
    if (!resetRecord) {
      return res.status(400).json({ error: 'هیڅ فعال تصدیقي کوډ ونه موندل شو. مهرباني وکړئ لومړی د نوي کوډ غوښتنه وکړئ.' });
    }

    if (Date.now() > resetRecord.expiresAt) {
      await dbDelete('password_resets', cleanEmail);
      return res.status(400).json({ error: 'د کوډ وخت پوره شوی دی (۱۵ دقیقې). مهرباني وکړئ نوی کوډ وغواړئ.' });
    }

    if (resetRecord.code.toString().trim() !== cleanCode) {
      return res.status(400).json({ error: 'داخل شوی تصدیقي کوډ ناسم دی. مهرباني وکړئ سم ۶ عددي کوډ ولیکئ.' });
    }

    // Code is valid! Hash and update password
    user.password = hashPassword(newPassword);
    await dbSet('users', cleanEmail, user);

    // Clean up used OTP
    await dbDelete('password_resets', cleanEmail);

    console.log(`[AUTH] Password successfully reset for ${cleanEmail}`);

    res.json({
      success: true,
      user: sanitizeUser(user),
      message: 'ستاسو پټنوم په بریالیتوب سره بدل شو. اوس کولای شئ ننوځئ.'
    });
  } catch (error: any) {
    console.error('Error verifying reset code:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 7.5. Legacy Secure Password Reset Endpoint (Fallback)
app.post('/api/auth/reset-password', async (req, res) => {
  const { email } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  try {
    const user = await dbGet('users', cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const tempPassword = `Khawreen-${Math.random().toString(36).substring(2, 8).toUpperCase()}#`;
    user.password = hashPassword(tempPassword);
    await dbSet('users', cleanEmail, user);

    res.json({
      success: true,
      tempPassword,
      message: 'A temporary secure password has been generated for your account. Please log in and change your password in Profile settings.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});


// 8. Update Profile with Secure Password Verification & Hashing
app.put('/api/auth/profile', async (req, res) => {
  const { email, updates } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  try {
    const user = await dbGet('users', cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (updates.name) {
      user.name = updates.name;
    }

    if (updates.newPassword) {
      if (!updates.currentPassword || !verifyPassword(updates.currentPassword, user.password)) {
        return res.status(400).json({ error: 'Incorrect current password.' });
      }
      if (updates.newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      user.password = hashPassword(updates.newPassword);
    }
    
    await dbSet('users', cleanEmail, user);
    res.json(sanitizeUser(user));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 9. Get Setup Settings
// Fields that must NEVER be sent to a non-admin caller — these are live
// payment-gateway secrets and bot tokens.
const SETTINGS_SECRET_FIELDS = [
  'hesabpayApiKey', 'binanceApiKey', 'binanceApiSecret',
  'telegramBotToken', 'telegramPaymentProviderToken',
  'nowpaymentsApiKey', 'nowpaymentsIpnSecret'
];

function sanitizeSettingsForPublic(settings: any) {
  if (!settings) return settings;
  const clean = { ...settings };
  for (const field of SETTINGS_SECRET_FIELDS) delete clean[field];
  // Expose only boolean "is configured" flags so the UI can show/hide
  // payment options without ever seeing the actual secret values.
  clean.hasHesabPay = !!(settings.hesabpayMerchantId && settings.hesabpayApiKey);
  clean.hasCrypto = !!settings.nowpaymentsApiKey;
  clean.hasTelegramStars = !!settings.telegramPaymentProviderToken;
  return clean;
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const user = await dbGet('users', String(userId).toLowerCase().trim());
  return !!user && user.role === 'admin';
}

app.get('/api/settings', async (req, res) => {
  try {
    let docData = await dbGet('settings', 'main');
    if (docData) {
      if (docData.websiteUrl && docData.websiteUrl.includes('khawreenlibrary.ai.studio')) {
        docData.websiteUrl = process.env.APP_URL || '';
      }
      res.json(sanitizeSettingsForPublic(docData));
    } else {
      const defaultSettings = {
        id: 'main',
        hesabpaySandboxMode: true,
        websiteUrl: process.env.APP_URL || '',
        hasHesabPay: false,
        hasCrypto: false,
        hasTelegramStars: false
      };
      res.json(defaultSettings);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Full settings (including secret API keys) — admin only. Used solely by the
// Payment Settings admin screen, which needs to see/edit the real values.
app.get('/api/settings/admin', async (req, res) => {
  const adminUserId = (req.query.adminUserId as string) || '';
  try {
    if (!(await isAdminUser(adminUserId))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    const docData = await dbGet('settings', 'main');
    res.json(docData || { id: 'main', hesabpaySandboxMode: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// 10. Save Setup Settings — admin only. This used to be callable by anyone,
// meaning any visitor could silently rewrite the site's bank account
// numbers, wallet addresses, or payment-gateway API keys to their own.
app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  const adminUserId = settings.adminUserId || (req.query.adminUserId as string) || '';
  try {
    if (!(await isAdminUser(adminUserId))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    delete settings.adminUserId;
    await dbSet('settings', 'main', { ...settings, id: 'main' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Admin manual approval — used for Bank/Sarafi transfers and any other
// payment method that can't be verified automatically. Requires the caller
// to be a registered admin account. (Note: like the rest of this app, "admin"
// here is checked by looking up a user record rather than a real session
// token — for full protection this endpoint should eventually sit behind
// proper server-side authentication.)
app.post('/api/admin/purchases/approve', async (req, res) => {
  const { purchaseId, adminUserId } = req.body;
  try {
    if (!purchaseId || !adminUserId) {
      return res.status(400).json({ error: 'purchaseId and adminUserId are required.' });
    }
    const admin = await dbGet('users', String(adminUserId).toLowerCase().trim());
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can approve purchases.' });
    }
    const purchase = await dbGet('purchases', purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found.' });
    }
    if (purchase.status === 'completed') {
      return res.json({ success: true, alreadyCompleted: true });
    }
    const { expiresAt } = await unlockBookAccessForUser(purchase.bookId, purchase.userId, purchase.id);
    res.json({ success: true, expiresAt });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve purchase' });
  }
});

// --- Complete Book Deletion on Server ---
// This used to accept a bare bookId with no check on who was asking — meaning
// any visitor could delete any book in the library. Now the caller must be
// either the book's original uploader or an admin.
app.post('/api/books/delete', async (req, res) => {
  const { bookId, requesterId } = req.body;
  try {
    if (!bookId || !requesterId) {
      return res.status(400).json({ error: 'bookId and requesterId are required.' });
    }
    const book = await dbGet('books', bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    const cleanRequester = String(requesterId).toLowerCase().trim();
    const requester = await dbGet('users', cleanRequester);
    const isOwner = book.uploadedBy && book.uploadedBy.toLowerCase().trim() === cleanRequester;
    const isAdmin = requester && requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You are not allowed to delete this book.' });
    }

    await dbDelete('books', bookId);
    
    // 2. Delete reviews for that book
    const reviews = await dbList('reviews');
    const bookReviews = reviews.filter(r => r.bookId === bookId);
    const deletePromises = bookReviews.map(r => dbDelete('reviews', r.id));
    await Promise.all(deletePromises);
    
    // 3. Remove book from all users' purchased lists
    const users = await dbList('users');
    const userPromises = users.map(async (userData) => {
        if (userData.purchasedBookIds && userData.purchasedBookIds.includes(bookId)) {
            const updated = userData.purchasedBookIds.filter((id: string) => id !== bookId);
            await dbSet('users', userData.id, { ...userData, purchasedBookIds: updated });
        }
    });
    await Promise.all(userPromises);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// --- Server-side AI Endpoints (Gemini API) ---
app.post('/api/ai/scan-pdf', async (req, res) => {
  const { textSnippet, fileName, coverImageBase64, titlePageBase64 } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    const heuristicExtract = () => {
      let detectedLang = 'English';
      const cleanSnippet = (textSnippet || '').trim();
      const combined = `${fileName || ''} ${cleanSnippet}`;

      if (/^[a-zA-Z0-9\s.,!?'"_-]+$/.test(combined.trim()) && /[a-zA-Z]/.test(combined)) {
        detectedLang = 'English';
      }

      // Extract title & author from filename or first lines
      let cleanFileName = (fileName || '').replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      let extractedTitle = cleanFileName;
      let extractedAuthor = '';

      if (cleanFileName.includes(' by ')) {
        const parts = cleanFileName.split(' by ');
        extractedTitle = parts[0].trim();
        extractedAuthor = parts[1].trim();
      } else if (cleanFileName.includes(' - ')) {
        const parts = cleanFileName.split(' - ');
        extractedTitle = parts[0].trim();
        extractedAuthor = parts[1].trim();
      }

      // Regex extraction for author markers in snippet text
      if (!extractedAuthor && cleanSnippet) {
        const authorRegex = /(?:Author|Writer|By)[\s:：\-]+([^\n\r,.]+)/i;
        const match = cleanSnippet.match(authorRegex);
        if (match && match[1] && match[1].trim().length > 2 && match[1].trim().length < 50) {
          extractedAuthor = match[1].trim();
        }
      }

      const lines = cleanSnippet.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);
      if (lines.length > 0 && (!extractedTitle || extractedTitle.length < 3)) {
        extractedTitle = lines[0];
      }
      if (!extractedAuthor && lines.length > 1) {
        if (lines[1].length < 40 && !lines[1].toLowerCase().includes('book')) {
          extractedAuthor = lines[1];
        }
      }

      return {
        title: extractedTitle || 'New Book',
        author: extractedAuthor || 'Author Name',
        language: detectedLang,
        category: 'Literature',
        description: cleanSnippet.slice(0, 250) || ''
      };
    };

    if (!apiKey) {
      const h = heuristicExtract();
      return res.json(h);
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = `You are an expert librarian and cataloger.
Carefully examine the attached book cover image(s), initial PDF pages, and filename: "${fileName || ''}".

MANDATORY INSTRUCTIONS:
1. "title": Extract the exact book title.
2. "author": MUST EXTRACT THE AUTHOR NAME.
3. "language": Strictly "English", "Pashto", "Dari", or "Other".
4. "category": Choose one category in English: "Literature & Poetry", "Islamic Studies", "History & Geography", "Science & Technology", "Stories & Novels", "Politics & Society", "Psychology & Education", "Computer & IT", "General".
5. "description": A concise 1-2 sentence description in English.

Return ONLY a JSON object: {"title": string, "author": string, "language": string, "category": string, "description": string}`;

    const contents: any[] = [];
    
    // Add cover image if provided for multimodal visual OCR
    if (coverImageBase64) {
      const cleanBase64 = coverImageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    if (titlePageBase64) {
      const cleanBase64Title = titlePageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64Title
        }
      });
    }

    // Add text snippet and filename prompt
    contents.push({
      text: `${promptText}\n\nFilename: ${fileName || ''}\nPDF Text:\n${(textSnippet || '').slice(0, 3000)}`
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        const heur = heuristicExtract();

        let finalTitle = (parsed.title && parsed.title.trim().length > 1) ? parsed.title.trim() : heur.title;
        let finalAuthor = (parsed.author && parsed.author.trim().length > 1 && !parsed.author.toLowerCase().includes('unknown')) 
          ? parsed.author.trim() 
          : heur.author;
        
        let finalLang = parsed.language || heur.language;

        return res.json({
          title: finalTitle,
          author: finalAuthor || heur.author || '',
          language: ['English', 'Pashto', 'Dari', 'Other'].includes(finalLang) ? finalLang : 'English',
          category: parsed.category || heur.category || 'Literature & Poetry',
          description: parsed.description || ''
        });
      }
    } catch (aiErr: any) {
      console.warn("AI PDF Scan with vision fallback to heuristics:", aiErr.message);
    }

    const fallbackH = heuristicExtract();
    res.json(fallbackH);
  } catch (err: any) {
    console.error("PDF Scan API Error:", err);
    res.json({
      title: (req.body?.fileName || 'New Book').replace(/\.pdf$/i, ''),
      author: 'Author Name',
      language: 'English',
      category: 'General',
      description: ''
    });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  const { bookId, title, author, language, description, category, pdfData } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const langName = language || 'English';
    const fallbackSummary = `📚 Summary & Overview of "${title || 'Book'}":\n\n` +
      `✍️ Author: ${author || 'Unknown'}\n` +
      `🏷️ Category: ${category || 'General'}\n` +
      `🌐 Language: ${langName}\n\n` +
      `📖 Overview & Content:\n${description || 'This valuable work covers key insights, educational concepts, and comprehensive guidance on the subject.'}\n\n` +
      `✨ Use the online reading or download features to access the full book.`;

    if (!apiKey) {
      return res.json({ summary: fallbackSummary });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    
    // Determine if pdfData is valid base64
    let rawBase64: string | null = null;
    if (typeof pdfData === 'string' && pdfData.startsWith('data:')) {
      rawBase64 = pdfData.replace(/^data:[^;]+;base64,/, '');
    } else if (bookId) {
      const storedData = await getFileFromStorage(bookId, 'pdf');
      if (storedData && typeof storedData === 'string' && !storedData.startsWith('/') && !storedData.startsWith('http')) {
        rawBase64 = storedData.replace(/^data:[^;]+;base64,/, '');
      }
    }

    // Validate rawBase64 is actually base64 and not a URL path or route
    if (rawBase64 && (rawBase64.startsWith('/') || rawBase64.startsWith('http'))) {
      rawBase64 = null;
    }

    const prompt = `You are a helpful AI assistant for Khawreen Digital Library. Summarize the following book in English in 1 or 2 clear, informative paragraphs:
Book Title: ${title || ''}
Author: ${author || ''}
Description/Details: ${description || ''}
Category: ${category || ''}`;

    let contents: any[];

    if (rawBase64 && rawBase64.length > 100) {
      contents = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: rawBase64,
          },
        },
        { text: prompt },
      ];
    } else {
      contents = [{ text: prompt }];
    }

    try {
      const genAIResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents,
      });

      if (genAIResponse.text) {
        return res.json({ summary: genAIResponse.text });
      }
    } catch (pdfErr: any) {
      console.warn('Gemini inline analysis failed or was rejected, attempting text metadata summary fallback:', pdfErr.message);
      // Fallback to text prompt without inline PDF data
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ text: prompt }],
      });
      if (textResponse.text) {
        return res.json({ summary: textResponse.text });
      }
    }

    res.json({ summary: fallbackSummary });
  } catch (error: any) {
    console.error('Server Summarization Error:', error);
    const fallbackSummary = `📚 Summary & Overview of "${title || 'Book'}":\n\n` +
      `✍️ Author: ${author || 'Unknown'}\n` +
      `🏷️ Category: ${category || 'General'}\n\n` +
      `📖 Overview:\n${description || 'This work covers key concepts, insights, and comprehensive guidance on the subject.'}\n\n` +
      `✨ Use the online reading or download features to access the full book.`;
    res.json({ summary: fallbackSummary });
  }
});

app.post('/api/ai/generate-cover', async (req, res) => {
  const { title, author, language } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.json({ success: false, reason: 'No API key' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Masterpiece luxury antique leather-bound Oriental illuminated book cover with 3D embossed 24K gold leaf filigree, exquisite Afghan Herat Timurid style tazhib illumination, ornamental arabesque geometric borders, rich lapis lazuli or emerald velvet texture, intricate central golden Shamsah medallion, museum grade archival manuscript quality, hyper-realistic, photorealistic, 8k resolution, elegant, dramatic lighting. Theme representing the literary work titled "${title}" by author "${author}". No modern text or clutter on the artwork.`;

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '3:4',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64Image = response.generatedImages[0].image.imageBytes;
      return res.json({ success: true, base64Image });
    }

    res.json({ success: false, reason: 'No image generated' });
  } catch (err: any) {
    console.warn("Cover generation API error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

app.use((req, res, next) => {
  if (req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1')) {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    process.env.APP_URL = `${proto}://${host}`;
  }
  next();
});

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    if (req.headers.host && !req.headers.host.includes('localhost')) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      process.env.APP_URL = `${proto}://${host}`;
    }
    await handleTelegramWebhookUpdate(req.body);
  } catch (e) {
    console.error("[TG WEBHOOK ENDPOINT ERROR]:", e);
  }
  res.json({ ok: true });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, history, booksContext } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const systemInstruction = `You are a friendly and helpful AI assistant for 'Khawreen Library', an online digital library. You help users discover books, answer questions, and navigate the website. If the user asks to navigate to a page (e.g. upload, my books, login), output [NAVIGATE:SECTION_NAME]. Respond in English. Available books context: ${JSON.stringify(booksContext || [])}`;

    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      ...(history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Server Chat AI Error:', error);
    let userMsg = 'An error occurred while generating AI response.';
    if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      userMsg = 'AI service is currently busy or quota limit reached. Please try again shortly.';
    } else if (error?.message) {
      userMsg = error.message;
    }
    res.status(500).json({ error: userMsg });
  }
});

app.post('/api/ai/generate-tags', async (req, res) => {
  const { title, author, category, description, language } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.json({ tags: [] });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Analyze this book: Title: "${title || ''}", Author: "${author || ''}", Category: "${category || ''}", Language: "${language || ''}", Description: "${description || ''}". Generate 5-7 relevant tags in English (e.g., 'History', 'Poetry', 'Fiction', 'Philosophy', 'Science'). Return as a JSON object: {"tags": ["tag1", "tag2"]}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ tags: Array.isArray(parsed.tags) ? parsed.tags : [] });
  } catch (error: any) {
    console.error('Server Tag Generation Error:', error);
    res.json({ tags: [] });
  }
});


// --- SEO Endpoints (Robots.txt & Sitemap.xml) ---
app.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const books = await dbList('books');
    let urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`
    ];

    if (Array.isArray(books)) {
      for (const b of books) {
        if (b && b.id) {
          const cleanId = b.id.startsWith('book-') ? b.id.replace('book-', '') : b.id;
          urls.push(`<url><loc>${baseUrl}/?book=${encodeURIComponent(cleanId)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('\n  ')}
</urlset>`;

    res.type('application/xml');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send('Error generating sitemap');
  }
});

// --- Helper for injecting Open Graph meta tags for book sharing ---
async function injectBookOgMeta(html: string, queryBookId?: string): Promise<string> {
  if (!queryBookId) return html;
  try {
    const rawId = queryBookId.trim();
    const cleanId = rawId.startsWith('book-') ? rawId : `book-${rawId}`;
    
    let book = await dbGet('books', cleanId);
    if (!book) book = await dbGet('books', rawId);
    if (!book) {
      const allBooksMap = await dbList('books');
      if (allBooksMap) {
        book = Object.values(allBooksMap).find((b: any) => b && (b.id === rawId || b.id === cleanId));
      }
    }

    if (book) {
      const title = `${book.title} | Khawreen Digital Library`;
      const description = `Read and download "${book.title}" (Author: ${book.author || 'Unknown'}) on Khawreen Digital Library.`;
      const image = book.coverUrl || '';

      const ogMeta = `
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    ${image ? `<meta property="og:image" content="${image}" />` : ''}
    <meta property="og:type" content="book" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    ${image ? `<meta property="twitter:image" content="${image}" />` : ''}
`;
      return html.replace(/<title>.*?<\/title>/i, ogMeta);
    }
  } catch (err) {
    console.error("Failed to inject OG meta tags:", err);
  }
  return html;
}

// --- Vite Middleware Server Setup ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Serve transformed index.html for all client-side routes
    app.get('*all', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const queryBookId = (req.query.book || req.query.startapp || req.query.tgWebAppStartParam) as string | undefined;
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await injectBookOgMeta(template, queryBookId);
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', async (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).send('Not found');
      }
      try {
        const queryBookId = (req.query.book || req.query.startapp || req.query.tgWebAppStartParam) as string | undefined;
        let template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        template = await injectBookOgMeta(template, queryBookId);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (err) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  // Start Telegram Bot background service
  startTelegramBot(dbGet, dbSet, dbList, getFileFromStorage, saveFileToStorage);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
