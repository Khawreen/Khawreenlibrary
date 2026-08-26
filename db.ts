import { User, Book, Review, Ad, Purchase, Settings } from './types';
import { firestore } from './firebase';
import { hashPasswordClient, verifyPasswordClient } from './clientCrypto';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot as firestoreOnSnapshot,
  query,
  where
} from 'firebase/firestore';

const SESSION_KEY = 'khawreen_library_session';

// --- Generic Collection Names ---
export const collections = {
  users: 'users',
  books: 'books',
  reviews: 'reviews',
  ads: 'ads',
  purchases: 'purchases',
  settings: 'settings',
  telegram_users: 'telegram_users',
} as const;
type CollectionName = keyof typeof collections;

// --- Local Storage Cache for Offline & Static Host Support ---
const getLocalStorageKey = (col: string) => `khawreen_cache_${col}`;

const getCachedCollection = <T>(collectionName: string): T[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getLocalStorageKey(collectionName)) : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const saveCachedCollection = <T>(collectionName: string, items: T[]) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getLocalStorageKey(collectionName), JSON.stringify(items));
    }
  } catch {}
};

// --- In-Memory Cache for Synchronous Helpers ---
let cachedBooks: Book[] = getCachedCollection<Book>('books');
let cachedUsers: User[] = getCachedCollection<User>('users');
let cachedPurchases: Purchase[] = getCachedCollection<Purchase>('purchases');

// Custom events to notify components
const dispatchDataChangeEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datachanged'));
  }
};

const dispatchAuthChangeEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('authstatechanged'));
  }
};

// --- Universal Data Subscription (Works on Netlify & Cloud Run) ---
export const onSnapshot = <T>(collectionName: CollectionName, callback: (data: T[]) => void): (() => void) => {
  let active = true;
  let lastDataJson = '';

  const updateAndNotify = (items: T[]) => {
    if (!active) return;
    if (collectionName === 'books') {
      cachedBooks = items as unknown as Book[];
    } else if (collectionName === 'users') {
      cachedUsers = items as unknown as User[];
    } else if (collectionName === 'purchases') {
      cachedPurchases = items as unknown as Purchase[];
    }

    saveCachedCollection(collectionName, items);

    const currentJson = JSON.stringify(items);
    if (currentJson !== lastDataJson) {
      lastDataJson = currentJson;
      callback(items);
      dispatchDataChangeEvent();
    }
  };

  // 1. Initial immediate trigger from local cache if present
  const initialCache = getCachedCollection<T>(collectionName);
  if (initialCache.length > 0) {
    updateAndNotify(initialCache);
  }

  // 2. Poll server /api/data if running with Express server
  const pollServer = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/data/${collectionName}`);
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const items = await res.json() as T[];
        updateAndNotify(items);
      }
    } catch {
      // Server not available (e.g. running statically on Netlify)
    }
  };

  pollServer();
  const intervalId = setInterval(pollServer, 6000);

  // 3. Direct Firestore Realtime Listener (Universal cloud sync for Netlify, Vercel, & mobile)
  let unsubFirestore = () => {};
  try {
    const colRef = collection(firestore, collectionName);
    unsubFirestore = firestoreOnSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id;
          items.push({ ...data, id } as T);
        });
        if (items.length > 0 || !lastDataJson) {
          updateAndNotify(items);
        }
      },
      (err) => {
        // Silently fallback to REST polling and local storage cache
      }
    );
  } catch (e) {
    console.warn(`Firestore init error for ${collectionName}:`, e);
  }

  return () => {
    active = false;
    clearInterval(intervalId);
    unsubFirestore();
  };
};

export const get = async <T extends { id?: string; username?: string }>(
  collectionName: CollectionName,
  id: string
): Promise<T | null> => {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;

  // 1. Try Server API if available
  try {
    const res = await fetch(`/api/data/${collectionName}/${cleanId}`);
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
  } catch {}

  // 2. Direct Firestore fallback (on Netlify / static deployment)
  try {
    const docRef = doc(firestore, collectionName, cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as T;
    }
  } catch (err) {
    console.warn(`Firestore get error for ${collectionName}/${cleanId}:`, err);
  }

  // 3. Check cached items
  const cached = getCachedCollection<T>(collectionName);
  const found = cached.find((item: any) => item && (item.id === cleanId || item.id === id || (item.email && item.email.toLowerCase().trim() === cleanId)));
  if (found) return found;

  return null;
};

export const add = async <T extends { id: string }>(collectionName: CollectionName, item: T, id?: string) => {
  const docId = id || item.id;
  const cleanId = collectionName === 'users' ? docId.toLowerCase().trim() : docId;
  const cleanItem = { ...item, id: cleanId };

  let serverSuccess = false;
  try {
    const res = await fetch(`/api/data/${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanItem)
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      serverSuccess = true;
    }
  } catch {}

  // Direct Firestore write (Universal sync for Netlify & static hosts)
  if (!serverSuccess) {
    try {
      const docRef = doc(firestore, collectionName, cleanId);
      await setDoc(docRef, cleanItem, { merge: true });
    } catch (err: any) {
      console.error(`Direct Firestore add error for ${collectionName}:`, err);
      // Even if offline, save locally
      const cached = getCachedCollection<any>(collectionName);
      const filtered = cached.filter((c: any) => c.id !== cleanId);
      filtered.push(cleanItem);
      saveCachedCollection(collectionName, filtered);
    }
  }

  dispatchDataChangeEvent();
};

export const update = async (collectionName: CollectionName, id: string, data: Partial<any>) => {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;

  let serverSuccess = false;
  try {
    const res = await fetch(`/api/data/${collectionName}/${cleanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      serverSuccess = true;
    }
  } catch {}

  // Direct Firestore update fallback
  if (!serverSuccess) {
    try {
      const docRef = doc(firestore, collectionName, cleanId);
      await setDoc(docRef, data, { merge: true });
    } catch (err: any) {
      console.error(`Direct Firestore update error for ${collectionName}:`, err);
      const cached = getCachedCollection<any>(collectionName);
      const idx = cached.findIndex((c: any) => c.id === cleanId);
      if (idx >= 0) {
        cached[idx] = { ...cached[idx], ...data };
        saveCachedCollection(collectionName, cached);
      }
    }
  }

  dispatchDataChangeEvent();
};

export const deleteItem = async (collectionName: CollectionName, id: string) => {
  const cleanId = collectionName === 'users' ? id.toLowerCase().trim() : id;

  let serverSuccess = false;
  try {
    const res = await fetch(`/api/data/${collectionName}/${cleanId}`, {
      method: 'DELETE'
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      serverSuccess = true;
    }
  } catch {}

  // Direct Firestore delete fallback
  if (!serverSuccess) {
    try {
      const docRef = doc(firestore, collectionName, cleanId);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error(`Direct Firestore delete error for ${collectionName}:`, err);
      const cached = getCachedCollection<any>(collectionName);
      const filtered = cached.filter((c: any) => c.id !== cleanId);
      saveCachedCollection(collectionName, filtered);
    }
  }

  dispatchDataChangeEvent();
};

// --- Authentication Functions (Robust Dual-Engine: Server + Firestore) ---

export const register = async (email: string, password: string, name: string, isAdmin: boolean = false) => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Try Server API first
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, name, isAdmin })
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const userProfile = await res.json();
      localStorage.setItem(SESSION_KEY, userProfile.email);
      dispatchAuthChangeEvent();
      dispatchDataChangeEvent();
      return userProfile;
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Registration failed.');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('already exists') || e.message.includes('at least 6 characters'))) {
      throw e;
    }
    // Proceed to Direct Firestore registration fallback (Netlify / Static host)
  }

  // 2. Direct Firestore fallback (on Netlify / static deployment)
  try {
    const userDocRef = doc(firestore, 'users', cleanEmail);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      throw new Error('An account with this email already exists.');
    }

    const isMasterAdmin = cleanEmail === 'mohammadgulkhawreen6@gmail.com';
    const hashedPassword = await hashPasswordClient(password);
    const userProfile: User = {
      id: cleanEmail,
      username: email,
      email: cleanEmail,
      name: name || email.split('@')[0],
      password: hashedPassword,
      role: isMasterAdmin ? 'admin' : 'user',
      purchasedBookIds: [],
      createdAt: Date.now()
    };

    await setDoc(userDocRef, userProfile);

    // Save locally
    const cached = getCachedCollection<User>('users');
    const filtered = cached.filter(u => u.email.toLowerCase().trim() !== cleanEmail);
    filtered.push(userProfile);
    saveCachedCollection('users', filtered);

    localStorage.setItem(SESSION_KEY, cleanEmail);
    dispatchAuthChangeEvent();
    dispatchDataChangeEvent();

    const { password: _, ...userToReturn } = userProfile;
    return userToReturn;
  } catch (err: any) {
    console.error('Direct Firestore register error:', err);
    throw new Error(err.message || 'Registration failed.');
  }
};

export const login = async (email: string, password: string): Promise<User> => {
  const cleanEmail = email.toLowerCase().trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const user = (await res.json()) as User;
      localStorage.setItem(SESSION_KEY, user.email);
      dispatchAuthChangeEvent();
      return user;
    }

    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Invalid email or password.');
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Invalid email or password.');
  }
};

export const loginWithTelegram = async (telegramUser: any): Promise<User> => {
  // 1. Try Server API first
  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser })
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const user = (await res.json()) as User;
      localStorage.setItem(SESSION_KEY, user.email);
      dispatchAuthChangeEvent();
      dispatchDataChangeEvent();
      return user;
    }
  } catch {}

  // 2. Direct Firestore fallback
  const tgId = String(telegramUser.id);
  const tgUsername = (telegramUser.username || '').toLowerCase().trim();
  const tgFullName =
    [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
    telegramUser.username ||
    'Telegram User';
  const email = tgUsername ? `${tgUsername}@telegram.org` : `tg_${tgId}@telegram.org`;

  try {
    const userDocRef = doc(firestore, 'users', email);
    const userSnap = await getDoc(userDocRef);

    let user: User;
    if (userSnap.exists()) {
      user = userSnap.data() as User;
    } else {
      const isMaster =
        email === 'mohammadgulkhawreen6@gmail.com' ||
        (tgUsername && `${tgUsername}@telegram.org` === 'mohammadgulkhawreen6@gmail.com');
      user = {
        id: email,
        username: tgUsername || email,
        email: email,
        name: tgFullName,
        role: isMaster ? 'admin' : 'user',
        purchasedBookIds: []
      };
      await setDoc(userDocRef, user);
    }

    localStorage.setItem(SESSION_KEY, user.email);
    dispatchAuthChangeEvent();
    dispatchDataChangeEvent();
    return user;
  } catch (e) {
    const localUser: User = {
      id: email,
      username: tgUsername || email,
      email: email,
      name: tgFullName,
      role: 'user',
      purchasedBookIds: []
    };
    localStorage.setItem(SESSION_KEY, localUser.email);
    dispatchAuthChangeEvent();
    return localUser;
  }
};

export const getTelegramUserById = async (telegramId: string | number): Promise<User | null> => {
  try {
    const res = await fetch(`/api/auth/telegram/${telegramId}`);
    if (res.ok) {
      const user = (await res.json()) as User;
      if (user && user.email) {
        localStorage.setItem(SESSION_KEY, user.email);
        dispatchAuthChangeEvent();
        return user;
      }
    }
  } catch {}

  try {
    const q = query(collection(firestore, 'users'), where('telegramId', '==', String(telegramId)));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const user = qSnap.docs[0].data() as User;
      localStorage.setItem(SESSION_KEY, user.email);
      dispatchAuthChangeEvent();
      return user;
    }
  } catch {}

  return null;
};

export const logout = async () => {
  localStorage.removeItem(SESSION_KEY);
  dispatchAuthChangeEvent();
};

export const requestPasswordResetCode = async (email: string): Promise<{ success: boolean; message: string; previewCode?: string; emailSent?: boolean }> => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Try Server API first
  try {
    const res = await fetch('/api/auth/forgot-password-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return data;
    } else {
      throw new Error(data.error || 'د کوډ په لېږلو کې ستونزه رامنځته شوه.');
    }
  } catch (e: any) {
    if (e.message && !e.message.includes('fetch')) {
      throw e;
    }
  }

  // 2. Direct Firestore fallback
  try {
    const userDocRef = doc(firestore, 'users', cleanEmail);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      throw new Error('د دې ایمیل سره کوم حساب ونه موندل شو. مهرباني وکړئ سم ایمیل ولیکئ.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const resetRef = doc(firestore, 'password_resets', cleanEmail);
    await setDoc(resetRef, {
      id: cleanEmail,
      email: cleanEmail,
      code,
      expiresAt,
      createdAt: Date.now()
    });

    return {
      success: true,
      message: 'د تایید ۶ عددي کوډ ستاسو ایمیل ته ولېږل شو.',
      previewCode: code
    };
  } catch (err: any) {
    console.error('Firestore reset code error:', err);
    throw new Error(err.message || 'د کوډ په چمتو کولو کې ستونزه رامنځته شوه.');
  }
};

export const verifyPasswordResetCode = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string; user?: User }> => {
  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = code.trim();

  // 1. Try Server API first
  try {
    const res = await fetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return data;
    } else {
      throw new Error(data.error || 'د کوډ تصدیق ونه شو.');
    }
  } catch (e: any) {
    if (e.message && !e.message.includes('fetch')) {
      throw e;
    }
  }

  // 2. Direct Firestore fallback
  try {
    const resetRef = doc(firestore, 'password_resets', cleanEmail);
    const resetSnap = await getDoc(resetRef);
    if (!resetSnap.exists()) {
      throw new Error('هیڅ فعال تصدیقي کوډ ونه موندل شو.');
    }

    const resetData = resetSnap.data();
    if (Date.now() > resetData.expiresAt) {
      await deleteDoc(resetRef).catch(() => {});
      throw new Error('د کوډ موده پوره شوې ده (۱۵ دقیقې). مهرباني وکړئ نوی کوډ وغواړئ.');
    }

    if (resetData.code.toString().trim() !== cleanCode) {
      throw new Error('داخل شوی تصدیقي کوډ ناسم دی.');
    }

    const userDocRef = doc(firestore, 'users', cleanEmail);
    const hashedPassword = await hashPasswordClient(newPassword);
    await setDoc(userDocRef, { password: hashedPassword }, { merge: true });
    await deleteDoc(resetRef).catch(() => {});

    return {
      success: true,
      message: 'ستاسو پټنوم په بریالیتوب سره بدل شو.'
    };
  } catch (err: any) {
    console.error('Firestore verify code error:', err);
    throw new Error(err.message || 'د پټنوم په ثبتولو کې تېروتنه رامنځته شوه.');
  }
};

export const sendPasswordReset = async (email: string): Promise<string | null> => {
  const cleanEmail = email.toLowerCase().trim();
  
  // 1. Try server first
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    if (res.ok) {
      const data = await res.json();
      return data.tempPassword || 'A temporary password was generated.';
    }
  } catch (e) {
    // Proceed to Direct Firestore fallback
  }

  // 2. Direct Firestore fallback
  try {
    const userDocRef = doc(firestore, 'users', cleanEmail);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return null;
    }
    const tempPassword = `Khawreen-${Math.random().toString(36).substring(2, 8).toUpperCase()}#`;
    const hashedTemp = await hashPasswordClient(tempPassword);
    await setDoc(userDocRef, { password: hashedTemp }, { merge: true });
    return tempPassword;
  } catch (err) {
    console.error('Password reset fallback error:', err);
    return null;
  }
};


export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  let active = true;
  let lastUserJson = '';

  const handleAuthChange = async () => {
    if (!active) return;

    const userEmail = localStorage.getItem(SESSION_KEY);
    if (userEmail) {
      try {
        const user = await get<User>('users', userEmail);
        if (active) {
          if (user) {
            const { password, ...userToReturn } = user;
            const currentJson = JSON.stringify(userToReturn);
            if (currentJson !== lastUserJson) {
              lastUserJson = currentJson;
              callback(userToReturn);
            }
          } else {
            // Check local fallback
            const cachedUsers = getCachedCollection<User>('users');
            const localUser = cachedUsers.find(
              u => u.email.toLowerCase().trim() === userEmail.toLowerCase().trim()
            );
            if (localUser) {
              const { password, ...userToReturn } = localUser;
              callback(userToReturn);
            } else {
              callback(null);
            }
          }
        }
      } catch {
        if (active) callback(null);
      }
    } else {
      if (active) {
        lastUserJson = '';
        callback(null);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('authstatechanged', handleAuthChange);
  }
  const intervalId = setInterval(handleAuthChange, 5000);
  handleAuthChange();

  return () => {
    active = false;
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('authstatechanged', handleAuthChange);
    }
  };
};

export const getUserCount = async (): Promise<number> => {
  try {
    const res = await fetch('/api/data/users');
    if (res.ok) {
      const users = await res.json();
      return users.length;
    }
  } catch {}

  try {
    const qSnap = await getDocs(collection(firestore, 'users'));
    return qSnap.size;
  } catch {
    const cached = getCachedCollection<User>('users');
    return cached.length;
  }
};

export const updateProfile = async (
  email: string,
  updates: { name?: string; currentPassword?: string; newPassword?: string }
): Promise<User> => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Try server first
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, updates })
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const updatedUser = (await res.json()) as User;
      dispatchAuthChangeEvent();
      return updatedUser;
    } else if (res.status === 400 || res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update profile.');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('Incorrect') || e.message.includes('Failed'))) {
      throw e;
    }
  }

  // 2. Direct Firestore fallback
  const userDocRef = doc(firestore, 'users', cleanEmail);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) {
    throw new Error('User not found.');
  }
  const userData = userSnap.data() as User;

  if (updates.newPassword) {
    const isCurrentValid = await verifyPasswordClient(updates.currentPassword || '', userData.password);
    if (!updates.currentPassword || !isCurrentValid) {
      throw new Error('Incorrect current password.');
    }
    if (updates.newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    userData.password = await hashPasswordClient(updates.newPassword);
  }

  if (updates.name) {
    userData.name = updates.name;
  }

  await setDoc(userDocRef, userData, { merge: true });
  dispatchAuthChangeEvent();
  const { password: _, ...userToReturn } = userData;
  return userToReturn;
};

// --- File Upload Helper (Hybrid Server / Base64 DataURL for Netlify) ---
export const uploadFile = async (file: File | Blob, type: 'cover' | 'pdf', bookId: string): Promise<string> => {
  try {
    const res = await fetch(`/api/upload/${type}/${bookId}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || (type === 'cover' ? 'image/jpeg' : 'application/pdf')
      },
      body: file
    });
    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return data.url;
    }
  } catch {}

  // Direct client-side Data URL conversion (for Netlify / Static hosting)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(new Error('File reader error'));
    reader.readAsDataURL(file);
  });
};

// --- Application Logic ---

export const recordBookDownloadTime = async (bookId: string): Promise<void> => {
  const cleanId = bookId.replace(/^book-/, '');
  const userEmail = typeof localStorage !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'anonymous') : 'anonymous';
  const downloadKey = `khawreen_download_timestamp_${userEmail}_${cleanId}`;
  
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(downloadKey, Date.now().toString());
  }

  // Grant access token
  await grantBookAccess(cleanId);
  dispatchDataChangeEvent();
};

export const incrementDownloadCount = async (bookId: string) => {
  const book = await get<Book>('books', bookId);
  if (book) {
    const newCount = (book.downloadCount || 0) + 1;
    await update('books', bookId, { downloadCount: newCount });
  }
};

export const addBookToUserLibrary = async (bookId: string): Promise<boolean> => {
  const cleanId = bookId.replace(/^book-/, '');
  const userEmail = localStorage.getItem(SESSION_KEY) || 'guest@khawreen.library';
  const now = Date.now();
  
  // Save permanent purchase flags
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`purchased_book_${cleanId}`, 'true');
      localStorage.setItem(`purchased_book_${bookId}`, 'true');
      localStorage.setItem(`purchased_book_book-${cleanId}`, 'true');
      // Set very long permanent access grant (100 years)
      const farFuture = now + 100 * 365 * 24 * 3600 * 1000;
      localStorage.setItem(`access_grant_${userEmail.toLowerCase().trim()}_${cleanId}`, String(farFuture));
      localStorage.setItem(`access_grant_${cleanId}`, String(farFuture));
    }
  } catch {}

  // Record access on backend
  try {
    await fetch('/api/access/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: cleanId, userId: userEmail, purchaseId: `purchase-${now}`, durationSeconds: 3153600000 })
    });
  } catch {}

  const cleanEmail = userEmail.toLowerCase().trim();
  const userProfile = await get<User>('users', cleanEmail);
  if (userProfile) {
    const existingIds = new Set(userProfile.purchasedBookIds || []);
    existingIds.add(bookId);
    existingIds.add(cleanId);
    existingIds.add(`book-${cleanId}`);
    const updatedBookIds = Array.from(existingIds);
    await update('users', cleanEmail, { purchasedBookIds: updatedBookIds });
    
    // Also update in cachedUsers
    const localUserIndex = cachedUsers.findIndex(u => u.email.toLowerCase().trim() === cleanEmail);
    if (localUserIndex >= 0) {
      cachedUsers[localUserIndex].purchasedBookIds = updatedBookIds;
    }
  }

  dispatchAuthChangeEvent();
  dispatchDataChangeEvent();
  return true;
};

export const deleteBook = async (book: Book, requesterId: string) => {
  let response: Response;
  try {
    response = await fetch('/api/books/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, requesterId })
    });
  } catch (networkErr) {
    // Server unreachable (e.g. offline) — fall back to local delete.
    await deleteItem('books', book.id);
    dispatchDataChangeEvent();
    return;
  }

  if (!response.ok) {
    // Server reached us and rejected the request (e.g. not the owner/admin)
    // — never silently bypass that by deleting locally instead.
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Delete failed');
  }
  dispatchDataChangeEvent();
};

export const checkBookAccess = (bookId: string): boolean => {
  const cleanId = bookId.replace(/^book-/, '');
  const book = cachedBooks.find(b => b.id === bookId || b.id === cleanId || b.id === `book-${cleanId}`);
  if (!book) return false;

  // Free books (not for sale or price <= 0) are freely accessible
  const isPaid = Boolean((book.isForSale || Number(book.price) > 0) && Number(book.price) > 0);
  if (!isPaid) {
    return true;
  }

  // 1. Check local permanent purchase flags
  if (typeof localStorage !== 'undefined') {
    if (
      localStorage.getItem(`purchased_book_${cleanId}`) === 'true' ||
      localStorage.getItem(`purchased_book_${bookId}`) === 'true' ||
      localStorage.getItem(`purchased_book_book-${cleanId}`) === 'true'
    ) {
      return true;
    }
  }

  const userEmail = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    const user = cachedUsers.find(u => u.email.toLowerCase().trim() === cleanEmail);
    if (user) {
      // Admin always has full access
      if (user.role === 'admin') {
        return true;
      }

      // Book uploader/author has access to their own book
      if (book.uploadedBy && book.uploadedBy.toLowerCase().trim() === cleanEmail) {
        return true;
      }

      // Check purchased book IDs
      if (user.purchasedBookIds && (
        user.purchasedBookIds.includes(bookId) ||
        user.purchasedBookIds.includes(cleanId) ||
        user.purchasedBookIds.includes(`book-${cleanId}`)
      )) {
        return true;
      }
    }
  }

  // 2. Check cached purchases collection for completed purchase
  const cachedPurchases = getCachedCollection<Purchase>('purchases');
  const hasCompletedPurchase = cachedPurchases.some(p => 
    p && p.status === 'completed' && 
    (p.bookId === bookId || p.bookId === cleanId || p.bookId === `book-${cleanId}`) &&
    (!userEmail || !p.userId || p.userId.toLowerCase().trim() === (userEmail || '').toLowerCase().trim() || p.userId === 'anonymous')
  );
  if (hasCompletedPurchase) {
    return true;
  }

  // 3. Fallback to active access grant
  const remaining = getBookAccessRemainingSeconds(bookId);
  return remaining > 0;
};

export const getBookAccessRemainingSeconds = (bookId: string): number => {
  const cleanId = bookId.replace(/^book-/, '');
  const userEmail = typeof localStorage !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'anonymous') : 'anonymous';

  if (typeof localStorage !== 'undefined') {
    try {
      if (
        localStorage.getItem(`purchased_book_${cleanId}`) === 'true' ||
        localStorage.getItem(`purchased_book_${bookId}`) === 'true'
      ) {
        return 999999;
      }
      const grantKey = `access_grant_${userEmail.toLowerCase().trim()}_${cleanId}`;
      const fallbackKey = `access_grant_${cleanId}`;
      const rawGrant = localStorage.getItem(grantKey) || localStorage.getItem(fallbackKey);
      if (rawGrant) {
        const expiresAt = Number(rawGrant);
        if (!isNaN(expiresAt) && expiresAt > Date.now()) {
          return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        }
      }
    } catch {}
  }
  return 0;
};

export const grantBookAccess = async (bookId: string, durationSeconds = 3153600000): Promise<number> => {
  const cleanId = bookId.replace(/^book-/, '');
  const userEmail = typeof localStorage !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'anonymous') : 'anonymous';
  const expiresAt = Date.now() + durationSeconds * 1000;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`purchased_book_${cleanId}`, 'true');
      localStorage.setItem(`purchased_book_${bookId}`, 'true');
      localStorage.setItem(`access_grant_${userEmail.toLowerCase().trim()}_${cleanId}`, String(expiresAt));
      localStorage.setItem(`access_grant_${cleanId}`, String(expiresAt));
    } catch {}
  }

  try {
    await fetch('/api/access/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: cleanId, userId: userEmail, durationSeconds })
    });
  } catch (e) {}

  dispatchDataChangeEvent();
  return durationSeconds;
};

// --- Settings ---

export const onSettingsSnapshot = (callback: (data: Settings | null) => void) => {
  let active = true;

  // Realtime Firestore settings listener
  try {
    const docRef = doc(firestore, 'settings', 'main');
    const unsub = firestoreOnSnapshot(
      docRef,
      (docSnap) => {
        if (!active) return;
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as Settings);
        } else {
          callback({
            id: 'main',
            hesabpayMerchantId: '',
            hesabpayApiKey: '',
            hesabpaySandboxMode: true,
            usdtTrc20Address: '',
            tonWalletAddress: '',
            telegramBotToken: '',
            websiteUrl: typeof window !== 'undefined' ? window.location.origin : ''
          });
        }
      },
      (err) => {
        // Silently fallback
      }
    );

    return () => {
      active = false;
      unsub();
    };
  } catch (e) {
    return () => {
      active = false;
    };
  }
};

export const putSettings = async (settings: Omit<Settings, 'id'>) => {
  let serverSuccess = false;
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) serverSuccess = true;
  } catch {}

  if (!serverSuccess) {
    try {
      const docRef = doc(firestore, 'settings', 'main');
      await setDoc(docRef, { ...settings, id: 'main' }, { merge: true });
    } catch (e) {
      console.error('Direct Firestore putSettings error:', e);
      throw new Error('Failed to save settings.');
    }
  }
};
