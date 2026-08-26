import fs from 'fs';
import path from 'path';
import { hashPassword } from './authUtils.ts';

// Helper to escape markdown characters to prevent Telegram API Markdown parsing errors
const cleanText = (str: any): string => {
  if (!str) return '';
  return String(str).replace(/[_*`[\]]/g, '');
};

// SVG cover generator
const generateSvgCover = (title: string, author: string): string => {
  const cleanTitle = (title || 'Book').substring(0, 30);
  const cleanAuthor = (author || 'Khawreen Library').substring(0, 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="400" height="600" fill="url(#grad)" />
    <rect x="20" y="20" width="360" height="560" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.2" rx="8"/>
    <circle cx="200" cy="220" r="70" fill="#ffffff" fill-opacity="0.1" />
    <text x="200" y="240" font-family="system-ui, sans-serif" font-size="64" text-anchor="middle">📚</text>
    <text x="200" y="350" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${cleanTitle}</text>
    <text x="200" y="390" font-family="system-ui, sans-serif" font-size="16" fill="#cbd5e1" text-anchor="middle">Khawreen Digital Library</text>
    <text x="200" y="440" font-family="system-ui, sans-serif" font-size="14" font-style="italic" fill="#ffffff" text-anchor="middle">Uploaded by: ${cleanAuthor}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
};

// Global tracker for active polling instance and processed updates to prevent duplicate execution
let currentBotPollId = 0;
const processedUpdateIds = new Set<number>();

let isMenuConfigured = false;
let isWebhookDeleted = false;

let globalDbGet: any = null;
let globalDbSet: any = null;
let globalDbList: any = null;
let globalGetFileFromFirestore: any = null;
let globalSaveFileToStorage: any = null;
let globalActiveToken: string = "";
let globalHandleUpdate: ((update: any, token: string) => Promise<void>) | null = null;

const isUrlValid = (urlStr?: string): boolean => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const clean = urlStr.trim().toLowerCase();
  if (!clean || !clean.startsWith('http')) return false;
  if (clean.includes('khawreenlibrary.ai.studio') || clean.includes('localhost') || clean.includes('127.0.0.1')) {
    return false;
  }
  return true;
};

const resolveAppUrl = async (): Promise<string> => {
  try {
    if (globalDbGet) {
      const settings = await globalDbGet('settings', 'main');
      if (settings?.websiteUrl && isUrlValid(settings.websiteUrl)) {
        return settings.websiteUrl.trim().replace(/\/+$/, '');
      }
    }
  } catch (e) {}
  if (process.env.APP_URL && isUrlValid(process.env.APP_URL)) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  return "https://ais-dev-gs2q2trl3kklmzx7owg2ng-123967204777.europe-west2.run.app";
};

const buildBookActionKeyboard = (book: any, appUrl: string, hasActiveAccess = false, remainingSeconds = 0) => {
  const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  const bookId = book?.id || book?._id || '';
  const isPaid = book?.isForSale && book?.price > 0;
  const webAppUrl = `${cleanAppUrl}?book=${bookId}`;
  const directDownloadUrl = `${cleanAppUrl}/api/files/download/${bookId}`;
  const buyUrl = `${cleanAppUrl}?book=${bookId}&buy=1`;

  if (isPaid && !hasActiveAccess) {
    return {
      inline_keyboard: [
        [
          {
            text: `💳 Purchase & Access 30s (${book.price} AFN)`,
            web_app: { url: buyUrl }
          }
        ],
        [
          {
            text: "🤖 Book Summary (AI)",
            callback_data: `summary_${bookId}`
          },
          {
            text: "💬 Reviews",
            callback_data: `review_${bookId}`
          }
        ],
        [
          {
            text: "🔗 Share",
            callback_data: `share_${bookId}`
          },
          {
            text: "🌐 Open in Library",
            web_app: { url: webAppUrl }
          }
        ]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        {
          text: hasActiveAccess ? `📖 Read (${remainingSeconds}s)` : "📖 Read Online",
          web_app: { url: webAppUrl }
        },
        {
          text: hasActiveAccess ? `📥 Download (${remainingSeconds}s)` : "📥 Download PDF",
          callback_data: `dl_${bookId}`
        }
      ],
      [
        {
          text: "🤖 Summary (AI)",
          callback_data: `summary_${bookId}`
        },
        {
          text: "💬 Reviews",
          callback_data: `review_${bookId}`
        },
        {
          text: "🔗 Share",
          callback_data: `share_${bookId}`
        }
      ],
      [
        {
          text: "⚡ Direct Download Link",
          url: directDownloadUrl
        }
      ]
    ]
  };
};

export async function setupTelegramWebhook(token: string) {
  if (!token) return false;
  try {
    const appUrl = await resolveAppUrl();
    if (!appUrl || appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
      return false;
    }

    // Always configure Chat Menu Button & Commands
    await setupTelegramBotMenu(token);

    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query", "inline_query"]
      })
    });
    const data = await res.json() as any;
    console.log(`[TG BOT] Configured Webhook (${webhookUrl}):`, data.description || data.ok);
    return data.ok;
  } catch (err: any) {
    console.error("[TG BOT] Failed setting webhook:", err?.message || err);
    return false;
  }
}

export async function deleteTelegramWebhook(token: string) {
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
    const data = await res.json() as any;
    console.log(`[TG BOT] Deleted Webhook:`, data.description || data.ok);
  } catch (err: any) {
    console.error("[TG BOT] Failed deleting webhook:", err?.message || err);
  }
}

export async function handleTelegramWebhookUpdate(update: any) {
  if (!update) return;
  try {
    const updateId = update.update_id;
    if (updateId) {
      if (processedUpdateIds.has(updateId)) {
        return;
      }
      processedUpdateIds.add(updateId);
      if (processedUpdateIds.size > 2000) {
        const oldest = Array.from(processedUpdateIds).slice(0, 500);
        oldest.forEach(id => processedUpdateIds.delete(id));
      }
    }

    let token = globalActiveToken;
    if (!token && globalDbGet) {
      const settings = await globalDbGet('settings', 'main');
      token = settings?.telegramBotToken;
    }
    if (!token) {
      token = process.env.TELEGRAM_BOT_TOKEN || '';
    }

    if (globalHandleUpdate) {
      await globalHandleUpdate(update, token.trim());
    }
  } catch (err: any) {
    console.error("[TG BOT WEBHOOK ERROR]:", err?.message || err);
  }
}

let lastConfiguredKey = '';

async function setupTelegramBotMenu(token: string) {
  if (!token) return;
  try {
    const appUrl = await resolveAppUrl();
    const currentKey = `${token.trim()}_${appUrl}`;
    if (lastConfiguredKey === currentKey) return;
    
    // 1. Configure Telegram Chat Menu Button to open Mini App directly
    const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🌐 Khawreen Online Library',
          web_app: { url: appUrl }
        }
      })
    });
    const menuData = await menuRes.json() as any;
    console.log(`[TG BOT] Configured Chat Menu Button (${appUrl}):`, menuData?.description || menuData?.ok);

    // 2. Set Bot Commands list matching full website tabs
    const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'app', description: '🌐 Open Online Library Mini App' },
          { command: 'books', description: '📚 View All Books' },
          { command: 'search', description: '🔍 Search Books' },
          { command: 'categories', description: '🏷️ Book Categories' },
          { command: 'upload', description: '📤 Upload PDF Book' },
          { command: 'mybooks', description: '📂 My Books' },
          { command: 'users', description: '📊 Member Statistics' },
          { command: 'about', description: 'ℹ️ About & Help' }
        ]
      })
    });
    const cmdData = await cmdRes.json() as any;
    console.log(`[TG BOT] Configured Bot Commands:`, cmdData?.description || cmdData?.ok);

    lastConfiguredKey = currentKey;
    isMenuConfigured = true;
  } catch (err) {
    console.error('[TG BOT] Error setting menu button/commands:', err);
  }
}

export async function startTelegramBot(
  dbGet: any, 
  dbSet: any, 
  dbList: any, 
  getFileFromFirestore?: (fileId: string, type: 'pdf' | 'cover') => Promise<string | null>,
  saveFileToStorage?: (fileId: string, base64Data: string, type: 'pdf' | 'cover') => Promise<void>
) {
  globalDbGet = dbGet;
  globalDbSet = dbSet;
  globalDbList = dbList;
  globalGetFileFromFirestore = getFileFromFirestore;
  globalSaveFileToStorage = saveFileToStorage;

  currentBotPollId++;
  const instancePollId = currentBotPollId;
  let offset = 0;
  let activeToken = "";

  const poll = async () => {
    if (instancePollId !== currentBotPollId) {
      console.log(`[TG BOT] Terminating old polling instance #${instancePollId}`);
      return;
    }

    try {
      // Get dynamic token from database settings main
      const settings = await dbGet('settings', 'main');
      const token = settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';

      if (!token) {
        if (instancePollId === currentBotPollId) setTimeout(poll, 10000);
        return;
      }

      activeToken = token.trim();
      globalActiveToken = activeToken;
      setupTelegramBotMenu(activeToken);

      // Attempt to register Webhook for 24/7 background execution
      const isWebhookOk = await setupTelegramWebhook(activeToken);
      if (isWebhookOk) {
        console.log('[TG BOT] Webhook is active! Listening for 24/7 Telegram updates via /api/telegram/webhook');
        if (instancePollId === currentBotPollId) {
          setTimeout(poll, 60000);
        }
        return;
      }

      const response = await fetch(`https://api.telegram.org/bot${activeToken}/getUpdates?offset=${offset}&timeout=5`);
      if (!response.ok) {
        if (response.status === 409) {
          console.log('[TG BOT] Webhook active (409 conflict on getUpdates). Updates will be processed via HTTP endpoint.');
          if (instancePollId === currentBotPollId) {
            setTimeout(poll, 60000);
          }
          return;
        }
        throw new Error(`Telegram API responded with status ${response.status}`);
      }

      const data = await response.json() as any;
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          if (update.update_id) {
            offset = Math.max(offset, update.update_id + 1);

            // Deduplicate incoming update_ids to prevent processing the same update twice
            if (processedUpdateIds.has(update.update_id)) {
              console.log(`[TG BOT] Skipping duplicate update_id ${update.update_id}`);
              continue;
            }
            processedUpdateIds.add(update.update_id);
            if (processedUpdateIds.size > 2000) {
              const oldest = Array.from(processedUpdateIds).slice(0, 500);
              oldest.forEach(id => processedUpdateIds.delete(id));
            }
          }

          await handleUpdate(update, activeToken);
        }
      }
    } catch (error: any) {
      console.error("[TELEGRAM BOT ERROR]:", error.message || error);
    }

    if (instancePollId === currentBotPollId) {
      setTimeout(poll, 1500);
    }
  };

  const getAllAvailableBooks = async (): Promise<any[]> => {
    try {
      const booksRaw = await dbList('books');
      const booksList = Array.isArray(booksRaw) ? booksRaw : Object.values(booksRaw || {});
      return booksList.filter((b: any) => b && b.title && b.status !== 'rejected');
    } catch (err) {
      console.error("[TG BOT] Error fetching books list:", err);
      return [];
    }
  };

  const resolveAppUrl = async (): Promise<string> => {
    try {
      const settings = await dbGet('settings', 'main');
      if (settings?.websiteUrl && isUrlValid(settings.websiteUrl)) {
        return settings.websiteUrl.trim().replace(/\/+$/, '');
      }
    } catch (e) {}
    if (process.env.APP_URL && isUrlValid(process.env.APP_URL)) {
      return process.env.APP_URL.trim().replace(/\/+$/, '');
    }
    return "https://ais-dev-gs2q2trl3kklmzx7owg2ng-123967204777.europe-west2.run.app";
  };

  const trackTelegramUser = async (fromUser: any, chatId: number) => {
    if (!fromUser || !fromUser.id) return;
    const userId = String(fromUser.id);
    const now = Date.now();
    try {
      const existing = await dbGet('telegram_users', userId);
      if (existing) {
        await dbSet('telegram_users', userId, {
          ...existing,
          id: userId,
          telegramId: fromUser.id,
          chatId: chatId,
          firstName: fromUser.first_name || existing.firstName || '',
          lastName: fromUser.last_name || existing.lastName || '',
          username: fromUser.username || existing.username || '',
          lastActive: now,
          messagesCount: (existing.messagesCount || 0) + 1
        });
      } else {
        await dbSet('telegram_users', userId, {
          id: userId,
          telegramId: fromUser.id,
          chatId: chatId,
          firstName: fromUser.first_name || '',
          lastName: fromUser.last_name || '',
          username: fromUser.username || '',
          languageCode: fromUser.language_code || 'en',
          firstSeen: now,
          lastActive: now,
          messagesCount: 1
        });
      }
    } catch (e) {
      console.error("Error tracking Telegram user:", e);
    }
  };

  const getOrCreateTelegramUser = async (fromUser: any, chatId: number) => {
    if (!fromUser || !fromUser.id) return null;
    const tgId = String(fromUser.id);
    const tgUsername = (fromUser.username || '').toLowerCase().trim();
    const tgFullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'Telegram User';
    const email = tgUsername ? `${tgUsername}@telegram.org` : `tg_${tgId}@telegram.org`;

    try {
      const allUsers = await dbList('users');
      let user = allUsers.find((u: any) => 
        u && (
          String(u.telegramId) === tgId || 
          u.email === `tg_${tgId}@telegram.org` ||
          (tgUsername && u.email === `${tgUsername}@telegram.org`) ||
          (tgUsername && u.telegramUsername && u.telegramUsername.toLowerCase() === tgUsername)
        )
      );

      const isMasterAdmin = (user && user.email === 'mohammadgulkhawreen6@gmail.com') || (email === 'mohammadgulkhawreen6@gmail.com');

      if (!user) {
        user = {
          id: email,
          username: email,
          email: email,
          name: tgFullName,
          password: hashPassword(`tg_${tgId}`),
          role: isMasterAdmin ? 'admin' : 'user',
          telegramId: fromUser.id,
          telegramUsername: fromUser.username || '',
          purchasedBookIds: [],
          createdAt: Date.now()
        };
        await dbSet('users', email, user);
      } else {
        user = {
          ...user,
          name: tgFullName || user.name,
          telegramId: fromUser.id,
          telegramUsername: fromUser.username || user.telegramUsername || '',
          role: isMasterAdmin ? 'admin' : (user.role || 'user')
        };
        await dbSet('users', user.email, user);
      }

      await trackTelegramUser(fromUser, chatId);
      return user;
    } catch (err) {
      console.error("Error in getOrCreateTelegramUser:", err);
      return {
        id: email,
        username: email,
        email: email,
        name: tgFullName,
        role: 'user',
        telegramId: fromUser.id,
        purchasedBookIds: []
      };
    }
  };

  const sendRegisterResponse = async (chatId: number, fromUser: any, token: string) => {
    const user = await getOrCreateTelegramUser(fromUser, chatId);
    const appUrl = await resolveAppUrl();
    const displayName = cleanText(user?.name || fromUser.first_name || 'User');
    const userEmail = user?.email || `tg_${fromUser.id}@telegram.org`;
    const roleText = user?.role === 'admin' ? '👑 Administrator' : '👤 User';

    const msg = `🎉 *Congratulations! Your account in Khawreen Digital Library has been successfully created and activated:*\n\n` +
      `👤 *Name:* ${displayName}\n` +
      `📧 *Email / Username:* \`${userEmail}\`\n` +
      `🆔 *Telegram ID:* \`${fromUser.id}\`\n` +
      `⭐ *Role:* ${roleText}\n\n` +
      `✨ Your account is now fully active! Use the button below to log in directly to the online library and enjoy full access to reading, downloads, reviews, and book uploads.`;

    const inlineKeyboard = [
      [{ text: "🌐 Direct Login to Online Library", web_app: { url: `${appUrl}?tg_auth=${fromUser.id}` } }],
      [
        { text: "📤 Upload Book", web_app: { url: `${appUrl}?view=upload&tg_auth=${fromUser.id}` } },
        { text: "👤 My Profile", callback_data: "auth_profile" }
      ],
      [{ text: "📚 All Books List", callback_data: "list_books" }]
    ];

    await sendTelegramMessage(chatId, msg, token, { inline_keyboard: inlineKeyboard });
  };

  const sendLoginResponse = async (chatId: number, fromUser: any, token: string) => {
    const user = await getOrCreateTelegramUser(fromUser, chatId);
    const appUrl = await resolveAppUrl();
    const displayName = cleanText(user?.name || fromUser.first_name || 'User');
    const userEmail = user?.email || `tg_${fromUser.id}@telegram.org`;

    const msg = `🔐 *Telegram Login:*\n\n` +
      `Hello ${displayName}! Your Telegram ID (\`${fromUser.id}\`) and account are verified with Khawreen Digital Library.\n\n` +
      `📧 *Account Email:* \`${userEmail}\`\n` +
      `🔑 *Authentication:* Fast and secure 1-click Telegram authorization.\n\n` +
      `Click the button below to open the online library with your active session:`;

    const inlineKeyboard = [
      [{ text: "🌐 1-Click Login to Online Library", web_app: { url: `${appUrl}?tg_auth=${fromUser.id}` } }],
      [
        { text: "👤 My Profile & Stats", callback_data: "auth_profile" },
        { text: "📂 My Books", callback_data: "auth_mybooks" }
      ]
    ];

    await sendTelegramMessage(chatId, msg, token, { inline_keyboard: inlineKeyboard });
  };

  const sendProfileResponse = async (chatId: number, fromUser: any, token: string) => {
    const user = await getOrCreateTelegramUser(fromUser, chatId);
    const appUrl = await resolveAppUrl();
    const books = await getAllAvailableBooks();
    
    const senderName = (fromUser.first_name || fromUser.username || "").toLowerCase();
    const myBooksList = books.filter((b: any) => {
      if (!b || !b.uploadedBy) return false;
      const upBy = b.uploadedBy.toLowerCase();
      return upBy === user?.email?.toLowerCase() || upBy.includes(senderName) || (user?.telegramId && String(b.telegramId) === String(user.telegramId));
    });

    const displayName = cleanText(user?.name || fromUser.first_name || 'User');
    const userEmail = user?.email || `tg_${fromUser.id}@telegram.org`;
    const roleText = user?.role === 'admin' ? '👑 Administrator' : '📖 Active Member';
    const purchasesCount = (user?.purchasedBookIds || []).length;

    const msg = `👤 *Khawreen Digital Library User Profile:*\n\n` +
      `🏷️ *Name:* ${displayName}\n` +
      `📧 *Email / Username:* \`${userEmail}\`\n` +
      `🆔 *Telegram ID:* \`${fromUser.id}\`\n` +
      `⭐ *Role:* ${roleText}\n` +
      `📚 *Your Uploaded Books:* ${myBooksList.length} books\n` +
      `💳 *Purchased / Premium Books:* ${purchasesCount}\n\n` +
      `Use the buttons below to manage your profile and access settings:`;

    const inlineKeyboard = [
      [{ text: "🌐 Open Online Profile", web_app: { url: `${appUrl}?view=profile&tg_auth=${fromUser.id}` } }],
      [
        { text: "📤 Upload New Book", web_app: { url: `${appUrl}?view=upload&tg_auth=${fromUser.id}` } },
        { text: "📂 My Books", callback_data: "auth_mybooks" }
      ],
      [{ text: "📚 Go to Library", callback_data: "list_books" }]
    ];

    await sendTelegramMessage(chatId, msg, token, { inline_keyboard: inlineKeyboard });
  };

  const sendBooksListResponse = async (chatId: number, token: string, customMessage?: string) => {
    const books = await getAllAvailableBooks();
    const appUrl = await resolveAppUrl();

    if (books.length > 0) {
      const reply = customMessage || `📚 *Khawreen Digital Library / Available Books (${books.length}):*\n\nClick on any book below to view details and download:`;
      const inlineKeyboard: any[] = [];
      
      books.slice(0, 20).forEach((b: any) => {
        const titleText = cleanText(b.title).substring(0, 32);
        inlineKeyboard.push([
          {
            text: `📥 ${titleText}`,
            callback_data: `dl_${b.id}`
          }
        ]);
      });

      inlineKeyboard.push([
        {
          text: "🌐 Open Online Library Application",
          web_app: { url: appUrl }
        }
      ]);

      await sendTelegramMessage(chatId, reply, token, { inline_keyboard: inlineKeyboard });
    } else {
      const emptyMsg = `📚 *Khawreen Digital Library*\n\nNo books are available in the system yet. You can send any PDF book file here to upload and publish!`;
      const inlineKeyboard = [
        [{ text: "🌐 Open Library Web App", web_app: { url: appUrl } }]
      ];
      await sendTelegramMessage(chatId, emptyMsg, token, { inline_keyboard: inlineKeyboard });
    }
  };

  const handleUpdate = async (update: any, token: string) => {
    globalHandleUpdate = handleUpdate;

    // Handle Telegram Stars Pre-Checkout Query
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      try {
        await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: pcq.id,
            ok: true
          })
        });
      } catch (e) {
        console.error("Error answering pre_checkout_query:", e);
      }
      return;
    }

    // 0. Track Telegram User in Database
    const fromUser = update.message?.from || update.callback_query?.from;
    const updateChatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (fromUser && updateChatId) {
      await trackTelegramUser(fromUser, updateChatId);
    }

    // Handle Successful Telegram Stars Payment
    if (update.message?.successful_payment) {
      const sp = update.message.successful_payment;
      const chatId = update.message.chat.id;
      let bookId = '';
      let purchaseId = '';
      let userId = String(update.message.from?.id || chatId);
      try {
        if (sp.invoice_payload) {
          const payload = JSON.parse(sp.invoice_payload);
          bookId = payload.bookId || '';
          purchaseId = payload.purchaseId || '';
          if (payload.userId) userId = payload.userId;
        }
      } catch (e) {}

      if (bookId) {
        const cleanBookId = bookId.replace(/^book-/, '');
        const grantKey = `${userId.toLowerCase().trim()}_${cleanBookId}`;
        const expiresAt = Date.now() + 30000;
        try {
          await dbSet('access_grants', grantKey, {
            id: grantKey,
            bookId: cleanBookId,
            userId: userId.toLowerCase().trim(),
            purchaseId: purchaseId || `purchase_stars_${Date.now()}`,
            grantedAt: Date.now(),
            expiresAt: expiresAt,
            durationSeconds: 30
          });
          if (purchaseId) {
            const p = await dbGet('purchases', purchaseId);
            if (p) {
              await dbSet('purchases', purchaseId, { ...p, status: 'completed', completedAt: Date.now() });
            }
          }
        } catch (e) {}

        await sendTelegramMessage(chatId, `🎉 *Telegram Stars Payment Successful!*\n\nYour 30-second online reading and download access has been unlocked automatically! Delivering your book now...`, token);
        await handleBookDownloadWithAd(chatId, cleanBookId, token);
      }
      return;
    }

    // 1. Handle Inline Button Callbacks (Clicks for Downloads / AI Summary / Reviews / Share / Categories / Viewing Books)
    const callbackQuery = update.callback_query;
    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      if (!chatId) return;
      const data = callbackQuery.data;

      const appUrl = await resolveAppUrl();

      if (data && data.startsWith('dl_')) {
        const bookId = data.substring(3);
        await answerCallbackQuery(callbackQuery.id, "⚡ Processing book... Please wait!", token);
        await handleBookDownloadWithAd(chatId, bookId, token);
      } else if (data && data.startsWith('summary_')) {
        const bookId = data.substring(8);
        await answerCallbackQuery(callbackQuery.id, "🤖 Generating AI Summary...", token);
        await sendChatAction(chatId, 'typing', token);
        try {
          const books = await getAllAvailableBooks();
          const book = books.find((b: any) => b.id === bookId || b.id.replace('book-', '') === bookId.replace('book-', ''));
          if (book) {
            let summaryText = `🤖 *AI Summary for "${cleanText(book.title)}"*\\n\\n`;
            summaryText += `✍️ *Author:* ${cleanText(book.author) || 'Unknown'}\n`;
            summaryText += `🌐 *Language:* ${book.language || 'English'}\n`;
            summaryText += `🏷️ *Category:* ${cleanText(book.category) || 'General'}\n\n`;
            summaryText += `📖 *Description & Summary:*\n${cleanText(book.description) || 'Summary, main topics, and essential content for this book are ready for reading.'}\n\n✨ _Click buttons below to read online or download:_`;
            
            await sendTelegramMessage(chatId, summaryText, token, buildBookActionKeyboard(book, appUrl));
          } else {
            await sendTelegramMessage(chatId, "⚠️ Sorry, the requested book was not found.", token);
          }
        } catch (e) {
          await sendTelegramMessage(chatId, "⚠️ An error occurred while generating the summary.", token);
        }
      } else if (data && data.startsWith('review_')) {
        const bookId = data.substring(7);
        await answerCallbackQuery(callbackQuery.id, "💬 Loading reviews...", token);
        await sendChatAction(chatId, 'typing', token);
        try {
          const books = await getAllAvailableBooks();
          const book = books.find((b: any) => b.id === bookId || b.id.replace('book-', '') === bookId.replace('book-', ''));
          
          let reviewsRaw = await dbList('reviews');
          let allReviews = Array.isArray(reviewsRaw) ? reviewsRaw : Object.values(reviewsRaw || {});
          let bookReviews = allReviews.filter((r: any) => r && (r.bookId === bookId || r.bookId === book?.id));

          if (book) {
            let reviewText = `💬 *Reviews and Comments for "${cleanText(book.title)}" (${bookReviews.length}):*\n\n`;
            if (bookReviews.length > 0) {
              bookReviews.slice(0, 5).forEach((r: any, idx: number) => {
                const stars = '⭐'.repeat(Math.min(5, Math.max(1, r.rating || 5)));
                reviewText += `${idx + 1}. 👤 *${cleanText(r.username) || 'User'}* (${stars})\n💬 ${cleanText(r.comment)}\n\n`;
              });
            } else {
              reviewText += `No reviews have been written for this book yet. You can be the first to review it via our online app!\n\n`;
            }

            await sendTelegramMessage(chatId, reviewText, token, buildBookActionKeyboard(book, appUrl));
          } else {
            await sendTelegramMessage(chatId, "⚠️ Sorry, the requested book was not found.", token);
          }
        } catch (e) {
          await sendTelegramMessage(chatId, "⚠️ An error occurred while loading reviews.", token);
        }
      } else if (data && data.startsWith('share_')) {
        const bookId = data.substring(6);
        await answerCallbackQuery(callbackQuery.id, "🔗 Generating share link...", token);
        try {
          const books = await getAllAvailableBooks();
          const book = books.find((b: any) => b.id === bookId || b.id.replace('book-', '') === bookId.replace('book-', ''));
          if (book) {
            const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
            const bookLink = `${cleanAppUrl}?book=${book.id}`;
            const shareText = `📚 *"${cleanText(book.title)}" on Khawreen Digital Library:*\n\n✍️ Author: ${cleanText(book.author) || 'Unknown'}\n\n🔗 Read Online & Direct Download:\n${bookLink}`;
            
            const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(bookLink)}&text=${encodeURIComponent(`📚 "${book.title}" (Khawreen Digital Library)`)}`;
            
            const shareKb = {
              inline_keyboard: [
                [{ text: "📲 Share to Telegram", url: tgShareUrl }],
                ...buildBookActionKeyboard(book, appUrl).inline_keyboard
              ]
            };

            await sendTelegramMessage(chatId, shareText, token, shareKb);
          }
        } catch (e) {}
      } else if (data && data.startsWith('cat_')) {
        const catKey = data.substring(4);
        await answerCallbackQuery(callbackQuery.id, "🏷️ Loading category...", token);
        await sendChatAction(chatId, 'typing', token);
        try {
          const books = await getAllAvailableBooks();
          let filteredBooks = books;
          let catTitle = "All Books";

          if (catKey === 'islamic') {
            catTitle = "🕌 Islamic Studies";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('islam') || t.toLowerCase().includes('quran') || t.toLowerCase().includes('hadith'))) ||
              b.title?.toLowerCase().includes('islam') || b.title?.toLowerCase().includes('quran')
            );
          } else if (catKey === 'literature') {
            catTitle = "📖 Literature & Poetry";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('literature') || t.toLowerCase().includes('poetry') || t.toLowerCase().includes('poem'))) ||
              b.title?.toLowerCase().includes('literature') || b.title?.toLowerCase().includes('poetry')
            );
          } else if (catKey === 'science') {
            catTitle = "🔬 Science & Technology";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('science') || t.toLowerCase().includes('tech') || t.toLowerCase().includes('medical') || t.toLowerCase().includes('physics'))) ||
              b.title?.toLowerCase().includes('science') || b.title?.toLowerCase().includes('physics') || b.title?.toLowerCase().includes('medicine')
            );
          } else if (catKey === 'history') {
            catTitle = "📜 History & Biography";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('history') || t.toLowerCase().includes('biography'))) ||
              b.title?.toLowerCase().includes('history')
            );
          } else if (catKey === 'novels') {
            catTitle = "✍️ Stories & Novels";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('novel') || t.toLowerCase().includes('story') || t.toLowerCase().includes('fiction'))) ||
              b.title?.toLowerCase().includes('novel') || b.title?.toLowerCase().includes('story')
            );
          } else if (catKey === 'computer') {
            catTitle = "💻 Computer & IT";
            filteredBooks = books.filter((b: any) => 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('computer') || t.toLowerCase().includes('it') || t.toLowerCase().includes('programming') || t.toLowerCase().includes('code'))) ||
              b.title?.toLowerCase().includes('computer') || b.title?.toLowerCase().includes('program') || b.title?.toLowerCase().includes('coding')
            );
          } else if (catKey === 'english') {
            catTitle = "🌐 English Books";
            filteredBooks = books.filter((b: any) => 
              b.language?.toLowerCase().includes('english') || 
              (b.tags && b.tags.some((t: string) => t.toLowerCase().includes('english')))
            );
          }

          if (filteredBooks.length > 0) {
            let msg = `✨ *Books in "${catTitle}" Category (${filteredBooks.length}):*\n\nClick on any book below to view details and download:`;
            const inlineKb: any[] = [];
            filteredBooks.slice(0, 10).forEach((b: any) => {
              inlineKb.push([
                { text: `📥 ${cleanText(b.title).substring(0, 32)}`, callback_data: `dl_${b.id}` }
              ]);
            });
            inlineKb.push([{ text: "🌐 Khawreen Online Library", url: appUrl }]);
            await sendTelegramMessage(chatId, msg, token, { inline_keyboard: inlineKb });
          } else {
            await sendBooksListResponse(chatId, token, `🏷️ No specific books found in the "${catTitle}" category. Here are all available library books:`);
          }
        } catch (e) {
          await sendBooksListResponse(chatId, token);
        }
      } else if (data === 'list_books') {
        await answerCallbackQuery(callbackQuery.id, "📚 Loading all books...", token);
        await sendChatAction(chatId, 'typing', token);
        await sendBooksListResponse(chatId, token);
      } else if (data === 'auth_register') {
        await answerCallbackQuery(callbackQuery.id, "🎉 Creating account...", token);
        await sendRegisterResponse(chatId, callbackQuery.from, token);
      } else if (data === 'auth_login') {
        await answerCallbackQuery(callbackQuery.id, "🔐 Logging in...", token);
        await sendLoginResponse(chatId, callbackQuery.from, token);
      } else if (data === 'auth_profile') {
        await answerCallbackQuery(callbackQuery.id, "👤 Opening profile...", token);
        await sendProfileResponse(chatId, callbackQuery.from, token);
      } else if (data === 'auth_mybooks') {
        await answerCallbackQuery(callbackQuery.id, "📂 Loading your books...", token);
        try {
          const books = await getAllAvailableBooks();
          const senderName = (callbackQuery.from?.first_name || callbackQuery.from?.username || "").toLowerCase();
          const tgId = String(callbackQuery.from?.id);
          
          const myBooksList = books.filter((b: any) => {
            if (!b || !b.uploadedBy) return false;
            const upBy = b.uploadedBy.toLowerCase();
            return upBy.includes(senderName) || upBy.includes(tgId) || upBy.includes("telegram");
          });

          if (myBooksList.length > 0) {
            let myMsg = `📂 *Your Uploaded Books (${myBooksList.length}):*\n\n`;
            const myKb: any[] = [];
            myBooksList.slice(0, 10).forEach((b: any) => {
              myKb.push([{ text: `📥 ${cleanText(b.title).substring(0, 32)}`, callback_data: `dl_${b.id}` }]);
            });
            myKb.push([{ text: "🌐 Online Library", web_app: { url: `${appUrl}?view=mybooks&tg_auth=${tgId}` } }]);
            await sendTelegramMessage(chatId, myMsg, token, { inline_keyboard: myKb });
          } else {
            const noBooksMsg = `📂 *Your Uploaded Books:*\n\nYou have not uploaded any books to Khawreen Digital Library yet.\n\nTo add a new book, send its PDF file directly in this chat!`;
            await sendTelegramMessage(chatId, noBooksMsg, token, {
              inline_keyboard: [
                [{ text: "📤 Upload New Book", web_app: { url: `${appUrl}?view=upload&tg_auth=${tgId}` } }]
              ]
            });
          }
        } catch (e) {
          await sendBooksListResponse(chatId, token);
        }
      }
      return;
    }

    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const userDisplayName = cleanText(message.from?.first_name || message.from?.username || "Telegram User");
    const appUrl = await resolveAppUrl();

    // Bottom Persistent Reply Keyboard with Account and Login options
    const mainMenuKeyboard = {
      keyboard: [
        [
          { text: "🌐 Khawreen Online Library", web_app: { url: `${appUrl}?tg_auth=${message.from?.id || ''}` } }
        ],
        [
          { text: "📚 Books" },
          { text: "🔍 Search" }
        ],
        [
          { text: "👤 My Account" },
          { text: "🔐 Login & Register" }
        ],
        [
          { text: "🏷️ Categories" },
          { text: "📤 Upload Book" }
        ],
        [
          { text: "📂 My Books" },
          { text: "📊 Member Statistics" }
        ],
        [
          { text: "ℹ️ About & Help" }
        ]
      ],
      resize_keyboard: true,
      persistent: true
    };

    // 2. Handle /start Command
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);

      // Check if deep linked to a specific book (e.g. /start book-12345 or /start 12345)
      if (parts.length > 1 && parts[1]) {
        const rawParam = parts[1];
        const cleanId = rawParam.startsWith('book-') ? rawParam : `book-${rawParam}`;
        
        try {
          const books = await getAllAvailableBooks();
          const foundBook = books.find((b: any) => 
            b && (b.id === rawParam || b.id === cleanId || b.id.replace('book-', '') === rawParam.replace('book-', ''))
          );

          if (foundBook) {
            const bookAppUrl = `${appUrl}?book=${foundBook.id}&tg_auth=${message.from?.id || ''}`;
            const caption = `📚 *${cleanText(foundBook.title)}*\n✍️ *Author:* ${cleanText(foundBook.author) || 'Unknown'}\n⭐ *Rating:* ${foundBook.rating || 5}/5\n📥 *Downloads:* ${foundBook.downloadCount || 0}\n\n📖 Click buttons below to read online or download directly:`;
            
            const replyMarkup = buildBookActionKeyboard(foundBook, appUrl);

            if (foundBook.coverUrl) {
              await sendAdPhoto(chatId, foundBook.coverUrl, caption, replyMarkup, token);
            } else {
              await sendTelegramMessage(chatId, caption, token, replyMarkup);
            }
            return;
          }
        } catch (err) {
          console.error("Deep link book lookup error in Telegram bot:", err);
        }
      }

      // Auto ensure user profile exists in database
      await getOrCreateTelegramUser(message.from, chatId);

      // Welcome Message + Main Menu
      const welcomeText = `Hello ${userDisplayName}! 📚\n\n✨ **Welcome to the official Khawreen Digital Library Bot!**\n\nYour Telegram account is automatically connected and ready.\n\nYou can browse all books, search by category, upload new PDF books, or open the online library web app directly:`;

      await sendTelegramMessage(chatId, welcomeText, token, mainMenuKeyboard);
      return;
    }

    const lowerText = text.toLowerCase();

    // 2.1 Handle Register Command (/register, register, signup)
    if (['/register', 'register', 'signup', 'create account', 'account'].some(cmd => lowerText === cmd.toLowerCase() || lowerText.startsWith('/register'))) {
      await sendRegisterResponse(chatId, message.from, token);
      return;
    }

    // 2.2 Handle Login / Auth Command (/login, login, signin, auth)
    if (['/login', 'login', 'signin', 'auth', '🔐 login & register', 'login & register'].some(cmd => lowerText === cmd.toLowerCase() || lowerText.startsWith('/login'))) {
      await sendLoginResponse(chatId, message.from, token);
      return;
    }

    // 2.3 Handle Profile / Account Command (/profile, /account, /me, profile, account)
    if (['/profile', '/account', '/me', 'profile', 'account', 'my account', 'my profile', '👤 my account'].some(cmd => lowerText === cmd.toLowerCase() || lowerText.startsWith('/profile') || lowerText.startsWith('/account'))) {
      await sendProfileResponse(chatId, message.from, token);
      return;
    }

    // 3. Handle About & Guide Command
    if (['/help', '/about', '/info', 'about', 'help', 'guide', 'ℹ️ about & help'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      const aboutText = `📚 *About Khawreen Digital Library:*\n\nKhawreen Library is a free digital library offering thousands of books across multiple categories.\n\n⚙️ *Bot Commands & Features:*\n• 📚 *Books:* List all available books in the library\n• 🔍 *Search:* Search books by title, author, or keyword\n• 🏷️ *Categories:* Browse books categorized by subject\n• 📤 *Upload Book:* Publish your own PDF books\n• 📂 *My Books:* View books you have uploaded\n• 📊 *Member Statistics:* View active members and statistics\n• 🌐 *Online Library:* Open the full web application`;
      
      await sendTelegramMessage(chatId, aboutText, token, {
        inline_keyboard: [
          [{ text: "🌐 Open Khawreen Library", web_app: { url: `${appUrl}?view=about` } }]
        ]
      });
      return;
    }

    // 4. Handle Search Prompt Trigger
    if (['/search', 'search', 'find', '🔍 search'].some(cmd => lowerText === cmd.toLowerCase())) {
      const searchPrompt = `🔍 *Search Khawreen Digital Library:*\n\nPlease type the book title, author name, or keyword to search the system.`;
      await sendTelegramMessage(chatId, searchPrompt, token);
      return;
    }

    // 5. Handle Categories Command
    if (['/categories', '/category', 'categories', 'category', '🏷️ categories'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      const catMsg = `🏷️ *Khawreen Digital Library Categories:*\n\nPlease select your preferred category:`;
      const catKeyboard = {
        inline_keyboard: [
          [
            { text: "🕌 Islamic Studies", callback_data: "cat_islamic" },
            { text: "📖 Literature & Poetry", callback_data: "cat_literature" }
          ],
          [
            { text: "🔬 Science & Medicine", callback_data: "cat_science" },
            { text: "📜 History & Biography", callback_data: "cat_history" }
          ],
          [
            { text: "✍️ Stories & Novels", callback_data: "cat_novels" },
            { text: "💻 Computer & IT", callback_data: "cat_computer" }
          ],
          [
            { text: "🌐 English Books", callback_data: "cat_english" },
            { text: "🌟 All Books", callback_data: "list_books" }
          ]
        ]
      };
      await sendTelegramMessage(chatId, catMsg, token, catKeyboard);
      return;
    }

    // 6. Handle Upload Guide Command
    if (['/upload', 'upload', 'upload book', '📤 upload book'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      const uploadMsg = `📤 *How to Upload and Publish Books:*\n\nYou can publish any PDF book to Khawreen Digital Library directly from this bot!\n\nSteps:\n1. Click the attachment icon (📎) below and send your PDF file.\n2. The bot will automatically process the document, generate a cover, and publish it to the library.`;
      await sendTelegramMessage(chatId, uploadMsg, token);
      return;
    }

    // 7. Handle My Books Command
    if (['/mybooks', 'my books', 'mybooks', '📂 my books'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      try {
        const books = await getAllAvailableBooks();
        const senderName = (message.from?.first_name || message.from?.username || "").toLowerCase();
        
        const myBooksList = books.filter((b: any) => {
          if (!b || !b.uploadedBy) return false;
          const upBy = b.uploadedBy.toLowerCase();
          return upBy.includes(senderName) || upBy.includes("telegram");
        });

        if (myBooksList.length > 0) {
          let myMsg = `📂 *Your Uploaded Books (${myBooksList.length}):*\n\n`;
          const myKb: any[] = [];
          myBooksList.slice(0, 10).forEach((b: any) => {
            myKb.push([{ text: `📥 ${cleanText(b.title).substring(0, 32)}`, callback_data: `dl_${b.id}` }]);
          });
          myKb.push([{ text: "🌐 Online Library", web_app: { url: `${appUrl}?view=mybooks` } }]);
          await sendTelegramMessage(chatId, myMsg, token, { inline_keyboard: myKb });
        } else {
          const noBooksMsg = `📂 *Your Uploaded Books:*\n\nYou have not uploaded any books to Khawreen Digital Library yet.\n\nTo add a new book, send its PDF file directly in this chat!`;
          await sendTelegramMessage(chatId, noBooksMsg, token);
        }
      } catch (e) {
        await sendBooksListResponse(chatId, token);
      }
      return;
    }

    // 8. Handle Website Link Command (/link, /website, /site, /url, /app, link, website)
    if (['/link', '/website', '/site', '/url', '/web', '/app', 'link', 'website', 'app', 'online library', '🌐 khawreen online library'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      const linkMsg = `🌐 *Khawreen Online Library Link:*\n\nClick the button below to open the online library portal:`
      await sendTelegramMessage(chatId, linkMsg, token, {
        inline_keyboard: [
          [{ text: "🌐 Open Khawreen Online Library", web_app: { url: appUrl } }]
        ]
      });
      return;
    }

    // 9. Handle Commands for Books Listing
    if (['/books', '/list', '/library', '/catalog', '/all', '/bookslist', 'books', 'library', '📚 books'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      await sendBooksListResponse(chatId, token);
      return;
    }

    // 10. Handle Commands for Users Statistics & Members Database
    if (['/users', '/members', '/stats', '/online', '/count', '/memberslist', 'users', 'members', 'stats', '📊 member statistics'].some(cmd => lowerText.includes(cmd.toLowerCase()))) {
      try {
        const allUsers = await dbList('telegram_users');
        const totalCount = allUsers.length;
        const now = Date.now();
        
        // Active in last 5 minutes (300,000 ms)
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        const onlineUsers = allUsers.filter((u: any) => u && u.lastActive && u.lastActive >= fiveMinutesAgo);
        
        // Active today (24 hours = 86,400,000 ms)
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const activeToday = allUsers.filter((u: any) => u && u.lastActive && u.lastActive >= oneDayAgo);

        let statsMsg = `📊 *Khawreen Library Member Database:*\n\n`;
        statsMsg += `👥 *Total Registered Members:* ${totalCount}\n`;
        statsMsg += `🟢 *Online / Active Now:* ${onlineUsers.length}\n`;
        statsMsg += `📅 *Active Today:* ${activeToday.length}\n\n`;

        if (onlineUsers.length > 0) {
          statsMsg += `🟢 *Currently Online Members:*\n`;
          onlineUsers.slice(0, 15).forEach((u: any, idx: number) => {
            const uName = cleanText([u.firstName, u.lastName].filter(Boolean).join(' ') || 'User');
            const handle = u.username ? `@${u.username}` : `ID: ${u.telegramId}`;
            statsMsg += `${idx + 1}. ${uName} (${handle})\n`;
          });
          if (onlineUsers.length > 15) {
            statsMsg += `...and ${onlineUsers.length - 15} more members online.\n`;
          }
        } else if (totalCount > 0) {
          statsMsg += `💡 *Recently Active Members:*\n`;
          const recentUsers = [...allUsers].sort((a: any, b: any) => (b.lastActive || 0) - (a.lastActive || 0)).slice(0, 8);
          recentUsers.forEach((u: any, idx: number) => {
            const uName = cleanText([u.firstName, u.lastName].filter(Boolean).join(' ') || 'User');
            const handle = u.username ? `@${u.username}` : `ID: ${u.telegramId}`;
            const diffMs = now - (u.lastActive || now);
            const mins = Math.floor(diffMs / (60 * 1000));
            const timeAgoStr = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
            statsMsg += `${idx + 1}. ${uName} (${handle}) - ${timeAgoStr}\n`;
          });
        }

        await sendTelegramMessage(chatId, statsMsg, token);
      } catch (err: any) {
        console.error("Error generating user stats:", err);
        await sendTelegramMessage(chatId, "⚠️ An error occurred while retrieving user statistics.", token);
      }
      return;
    }

    // 4. Handle PDF Document Upload
    if (message.document) {
      const doc = message.document;
      const isPdf = doc.mime_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        await sendTelegramMessage(chatId, "⚠️ Sorry, only PDF format files are accepted.", token);
        return;
      }

      // Check Telegram file size limit (20MB max for bot file download API)
      if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
        await sendTelegramMessage(
          chatId, 
          `⚠️ Telegram restricts bot downloads for files exceeding 20MB.\n\nPlease upload smaller files (<20MB) directly here, or use our online web application for larger books:`,  
          token,
          {
            inline_keyboard: [
              [{ text: "🌐 Khawreen Online Library", web_app: { url: appUrl } }]
            ]
          }
        );
        return;
      }

      const bookTitle = (doc.file_name || "Untitled Book").replace(/\.[^/.]+$/, "");
      const uploaderName = message.from?.first_name || message.from?.username || "Telegram User";

      await sendTelegramMessage(chatId, `⏳ Downloading and processing "${cleanText(bookTitle)}". Please wait...`, token);

      try {
        const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${doc.file_id}`);
        if (!fileInfoRes.ok) throw new Error("Failed to get file info from Telegram");
        const fileInfo = await fileInfoRes.json() as any;
        
        if (!fileInfo.ok || !fileInfo.result?.file_path) {
          throw new Error("Invalid file path in Telegram file info response");
        }

        const filePath = fileInfo.result.file_path;
        const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
        if (!fileRes.ok) throw new Error("Failed to download PDF file from Telegram servers");

        const arrayBuffer = await fileRes.arrayBuffer();
        const pdfBase64 = "data:application/pdf;base64," + Buffer.from(arrayBuffer).toString('base64');
        const coverBase64 = generateSvgCover(bookTitle, uploaderName);

        const bookId = `book-tg-${Date.now()}`;

        if (saveFileToStorage) {
          await saveFileToStorage(bookId, pdfBase64, 'pdf');
          await saveFileToStorage(bookId, coverBase64, 'cover');
        }

        const newBook = {
          id: bookId,
          title: bookTitle,
          author: uploaderName,
          language: "Pashto / English",
          coverUrl: `/api/files/cover/${bookId}`,
          pdfUrl: `/api/files/download/${bookId}`,
          pdfFileName: doc.file_name || `${bookTitle}.pdf`,
          uploadedBy: message.from?.email || uploaderName || "Telegram",
          status: "approved",
          isForSale: false,
          price: 0,
          tags: ["Telegram Upload", "E-Book"],
          downloadCount: 0,
          createdAt: Date.now()
        };

        await dbSet('books', bookId, newBook);

        const successMsg = `🎉 Success! Your book has been uploaded and published in Khawreen Digital Library.\n\n📖 Book Title: ${cleanText(bookTitle)}\n👤 Author/Uploader: ${cleanText(uploaderName)}\n\nYou and other users can now access this book in the web app and Telegram bot!`;
        
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "📥 Download This Book", callback_data: `dl_${bookId}` },
              { text: "📱 View in App", web_app: { url: `${appUrl}?book=${bookId}` } }
            ]
          ]
        };

        await sendTelegramMessage(chatId, successMsg, token, replyMarkup);

      } catch (err: any) {
        console.error("[TELEGRAM UPLOAD FAILED]:", err);
        await sendTelegramMessage(chatId, `❌ An error occurred during book upload:\n${err.message || err}`, token);
      }
      return;
    }

    // 5. Handle Text Search / Query
    if (text) {
      try {
        const books = await getAllAvailableBooks();
        const searchWord = text.toLowerCase().trim();

        const foundBooks = books.filter((book: any) => {
          const titleMatch = book.title?.toLowerCase().includes(searchWord);
          const authorMatch = book.author?.toLowerCase().includes(searchWord);
          const langMatch = book.language?.toLowerCase().includes(searchWord);
          const tagMatch = Array.isArray(book.tags) && book.tags.some((t: string) => t.toLowerCase().includes(searchWord));
          return titleMatch || authorMatch || langMatch || tagMatch;
        });

        if (foundBooks.length > 0) {
          let reply = `🔍 Found the following books for "${cleanText(text)}":\n\nClick below to view and download:`
          const inlineKeyboard: any[] = [];

          foundBooks.slice(0, 10).forEach((book) => {
            const titleText = cleanText(book.title).substring(0, 32);
            inlineKeyboard.push([
              {
                text: `📥 ${titleText}`,
                callback_data: `dl_${book.id}`
              }
            ]);
          });

          inlineKeyboard.push([
            { text: "📱 View All in App", web_app: { url: `${appUrl}?search=${encodeURIComponent(text)}` } }
          ]);

          await sendTelegramMessage(chatId, reply, token, { inline_keyboard: inlineKeyboard });
        } else {
          // No exact match, show all available books as fallback
          await sendBooksListResponse(
            chatId, 
            token, 
            `🔍 No exact match found for "${cleanText(text)}".\n\n📚 Here are all available books in Khawreen Digital Library:`
          );
        }
      } catch (err) {
        console.error("Search error in TG Bot:", err);
        await sendBooksListResponse(chatId, token);
      }
      return;
    }
  };

  // 6. Download handling with advertisement showing first
  const handleBookDownloadWithAd = async (chatId: number, bookId: string, token: string) => {
    const appUrl = await resolveAppUrl();
    try {
      let book = await dbGet('books', bookId);
      if (!book) {
        const books = await getAllAvailableBooks();
        book = books.find((b: any) => b && (b.id === bookId || b.id === `book-${bookId}` || b.id?.replace('book-', '') === bookId.replace('book-', '')));
      }

      if (!book) {
        await sendTelegramMessage(chatId, "❌ Sorry, this book was not found in the system.", token);
        return;
      }

      const cleanBookId = (book.id || bookId).replace(/^book-/, '');
      const isPaid = book.isForSale && book.price > 0;

      // Access control check for paid books (30-second access window)
      let hasActiveAccess = false;
      let remainingSeconds = 0;

      if (isPaid) {
        const grantKeys = [
          `tg_${chatId}_${cleanBookId}`,
          `${chatId}_${cleanBookId}`,
          `book_${cleanBookId}`
        ];

        for (const gKey of grantKeys) {
          const grant = await dbGet('access_grants', gKey);
          if (grant && grant.expiresAt > Date.now()) {
            hasActiveAccess = true;
            remainingSeconds = Math.max(0, Math.ceil((grant.expiresAt - Date.now()) / 1000));
            break;
          }
        }

        // Also check if admin user
        const tgUser = await dbGet('telegram_users', chatId.toString());
        if (tgUser && (tgUser.role === 'admin' || book.uploadedBy === tgUser.email)) {
          hasActiveAccess = true;
        }

        if (!hasActiveAccess) {
          const buyUrl = `${appUrl}?book=${book.id}&buy=1`;
          const lockMsg = `🔒 *This is a Premium Book!*\n\n` +
            `📚 *Title:* ${cleanText(book.title)}\n` +
            `👤 *Author:* ${cleanText(book.author) || 'Unknown'}\n` +
            `💰 *Price:* ${book.price} AFN\n\n` +
            `✨ *Access Terms:*\n` +
            `After purchasing, you receive 30 seconds of online access to download and save the complete PDF to your device. After 30 seconds, online access will lock again.\n\n` +
            `Click below to purchase and access:`;

          const lockKeyboard = {
            inline_keyboard: [
              [{ text: `💳 Buy Now (${book.price} AFN)`, web_app: { url: buyUrl } }],
              [{ text: "🌐 Online Library", web_app: { url: appUrl } }]
            ]
          };

          await sendTelegramMessage(chatId, lockMsg, token, lockKeyboard);
          return;
        }
      }

      // Fetch active advertisements
      const adsMap = await dbList('ads');
      const ads = adsMap ? Object.values(adsMap) : [];
      let adToShow: any = null;
      if (ads.length > 0) {
        adToShow = ads[Math.floor(Math.random() * ads.length)];
      }

      await sendChatAction(chatId, 'upload_document', token);

      // Show Advertisement if available
      if (adToShow) {
        const adText = `📢 *Sponsored Ad*\n\n*${cleanText(adToShow.title)}*\n${cleanText(adToShow.description)}`;
        let replyMarkup = undefined;
        if (adToShow.linkUrl) {
          replyMarkup = {
            inline_keyboard: [[{ text: "🌐 Sponsor Website", url: adToShow.linkUrl }]]
          };
        }

        if (adToShow.imageUrl) {
          await sendAdPhoto(chatId, adToShow.imageUrl, adText, replyMarkup, token);
        } else {
          await sendTelegramMessage(chatId, adText, token, replyMarkup);
        }

        const progressMsg = await sendTelegramMessage(chatId, `⏳ *Processing "${cleanText(book.title)}"...*\n\n🔄 Preparing file: [██████░░░░] 60%`, token);
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (progressMsg && progressMsg.result && progressMsg.result.message_id) {
          await editTelegramMessage(chatId, progressMsg.result.message_id, `⚡ *Processing "${cleanText(book.title)}"...*\n\n✨ File ready: [██████████] 100%`, token);
        }
      } else {
        const progressMsg = await sendTelegramMessage(chatId, `⏳ *Processing "${cleanText(book.title)}"...*\n\n🔄 Preparing file: [████████░░] 80%`, token);
        await new Promise(resolve => setTimeout(resolve, 800));
        if (progressMsg && progressMsg.result && progressMsg.result.message_id) {
          await editTelegramMessage(chatId, progressMsg.result.message_id, `⚡ *Processing "${cleanText(book.title)}"...*\n\n✨ Uploading file... [██████████] 100%`, token);
        }
      }

      if (!book.pdfUrl) {
        await sendTelegramMessage(chatId, "❌ No PDF file is available for this book.", token);
        return;
      }

      // Increment download count
      book.downloadCount = (book.downloadCount || 0) + 1;
      await dbSet('books', book.id, book);

      let pdfBuffer: Buffer | null = null;
      let pdfFileName = book.pdfFileName || `${cleanText(book.title) || 'book'}.pdf`;
      if (!pdfFileName.toLowerCase().endsWith('.pdf')) {
        pdfFileName += '.pdf';
      }

      // Candidate file IDs
      const candidateIds: string[] = [];
      if (book.id) candidateIds.push(book.id);
      if (book.id && book.id.startsWith('book-')) candidateIds.push(book.id.replace('book-', ''));
      if (book.pdfUrl && book.pdfUrl.includes('/api/files/')) {
        const extractedId = book.pdfUrl.split('/').pop();
        if (extractedId) candidateIds.push(extractedId);
      }

      // Strategy 1: book.pdfUrl is data URI
      if (book.pdfUrl && book.pdfUrl.startsWith('data:')) {
        const parts = book.pdfUrl.split(',');
        if (parts[1]) {
          pdfBuffer = Buffer.from(parts[1], 'base64');
        }
      }

      // Strategy 2: Get chunked storage data from getFileFromFirestore
      if (!pdfBuffer && getFileFromFirestore) {
        for (const pid of candidateIds) {
          try {
            const chunkedData = await getFileFromFirestore(pid, 'pdf');
            if (chunkedData) {
              const base64Data = chunkedData.includes(',') ? chunkedData.split(',')[1] : chunkedData;
              pdfBuffer = Buffer.from(base64Data, 'base64');
              if (pdfBuffer && pdfBuffer.length > 0) break;
            }
          } catch (e) {}
        }
      }

      // Strategy 3: Read directly from local uploads/pdfs directory
      if (!pdfBuffer) {
        for (const pid of candidateIds) {
          try {
            const filePath = path.resolve(process.cwd(), 'uploads', 'pdfs', `${pid}.dat`);
            if (fs.existsSync(filePath)) {
              const fileContent = fs.readFileSync(filePath, 'utf-8');
              const base64Data = fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
              pdfBuffer = Buffer.from(base64Data, 'base64');
              if (pdfBuffer && pdfBuffer.length > 0) break;
            }
          } catch (e) {}
        }
      }

      // Strategy 4: Fetch via HTTP from local express server endpoint or remote URL
      if (!pdfBuffer && book.pdfUrl) {
        try {
          const fetchUrl = book.pdfUrl.startsWith('/') ? `http://127.0.0.1:3000${book.pdfUrl}` : book.pdfUrl;
          const fileRes = await fetch(fetchUrl);
          if (fileRes.ok) {
            const arrayBuf = await fileRes.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuf);
          }
        } catch (e) {
          console.error("[TG BOT] HTTP Fetch PDF failed:", e);
        }
      }

      const directDownloadUrl = book.pdfUrl?.startsWith('/') 
        ? `${appUrl}${book.pdfUrl}` 
        : (book.pdfUrl || `${appUrl}?book=${book.id}`);
      const webAppBookUrl = `${appUrl}?book=${book.id}`;

      let documentSentSuccessfully = false;

      if (pdfBuffer && pdfBuffer.length > 0) {
        try {
          // Safe filename for HTTP multipart header (prevents header encoding issues)
          const safeAsciiName = `book_${book.id.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
          const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
          
          const formData = new FormData();
          formData.append('chat_id', chatId.toString());
          formData.append('document', pdfBlob, safeAsciiName);
          let caption = `📚 *${cleanText(book.title)}*\n👤 Author: ${cleanText(book.author) || 'Unknown'}\n\nYour book is ready! Enjoy reading with Khawreen Digital Library.`;
          let plainCaption = `📚 ${cleanText(book.title)}\n👤 Author: ${cleanText(book.author) || 'Unknown'}\n\nYour book is ready! Enjoy reading with Khawreen Digital Library.`;
          
          if (isPaid && hasActiveAccess) {
            caption = `📚 *${cleanText(book.title)}*\n👤 Author: ${cleanText(book.author) || 'Unknown'}\n\n🎉 *30-Second Access:* The full PDF has been delivered. Please download and save it to your device now.\n⏳ *Time Remaining:* ${remainingSeconds} seconds.`;
            plainCaption = `📚 ${cleanText(book.title)}\n👤 Author: ${cleanText(book.author) || 'Unknown'}\n\nYour 30-second online access is active. Please save this PDF file to your device now.`;
          }

          const replyMarkup = buildBookActionKeyboard(book, appUrl, hasActiveAccess, remainingSeconds);
          formData.append('reply_markup', JSON.stringify(replyMarkup));
          formData.append('caption', caption);
          formData.append('parse_mode', 'Markdown');

          let docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
            method: 'POST',
            body: formData
          });

          if (!docRes.ok) {
            const errText = await docRes.text();
            console.warn(`[TG BOT] sendDocument Markdown failed (${docRes.status}): ${errText}, retrying without parse_mode...`);
            
            // Retry without parse_mode
            const plainFormData = new FormData();
            plainFormData.append('chat_id', chatId.toString());
            plainFormData.append('document', pdfBlob, safeAsciiName);
            plainFormData.append('caption', plainCaption);
            plainFormData.append('reply_markup', JSON.stringify(replyMarkup));

            docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
              method: 'POST',
              body: plainFormData
            });
          }

          if (docRes.ok) {
            documentSentSuccessfully = true;
          } else {
            const errText = await docRes.text();
            console.warn(`[TG BOT] sendDocument HTTP error (${docRes.status}): ${errText}`);
          }
        } catch (docErr: any) {
          console.error("[TG BOT] sendDocument exception:", docErr.message || docErr);
        }
      }

      // Fallback if document upload failed or file wasn't directly attachable
      if (!documentSentSuccessfully) {
        const fallbackMsg = `📚 *${cleanText(book.title)}*\n👤 Author: ${cleanText(book.author) || 'Unknown'}\n\nBook is ready! Use the buttons below for direct download or online reading:`
        const replyMarkup = buildBookActionKeyboard(book, appUrl);
        await sendTelegramMessage(chatId, fallbackMsg, token, replyMarkup);
      }

    } catch (err: any) {
      console.error("[TELEGRAM DOWNLOAD ERROR]:", err);
      await sendTelegramMessage(chatId, `❌ An error occurred while downloading the book:\n${err.message || err}`, token);
    }
  };

  const sendAdPhoto = async (chatId: number, imageUrl: string, caption: string, replyMarkup: any, token: string) => {
    try {
      if (imageUrl.startsWith('data:')) {
        const parts = imageUrl.split(',');
        const base64Data = parts[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('chat_id', chatId.toString());
        formData.append('photo', blob, 'ad_image.jpg');
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
        if (replyMarkup) {
          formData.append('reply_markup', JSON.stringify(replyMarkup));
        }

        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imageUrl,
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          })
        });
      }
    } catch (e) {
      console.error("Failed to send Ad photo:", e);
      await sendTelegramMessage(chatId, caption, token, replyMarkup);
    }
  };

  const sendChatAction = async (chatId: number, action: string, token: string) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action })
      });
    } catch (e) {}
  };

  const answerCallbackQuery = async (callbackQueryId: string, text: string, token: string, showAlert = false) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: showAlert
        })
      });
    } catch (e) {}
  };

  const editTelegramMessage = async (chatId: number, messageId: number, text: string, token: string, replyMarkup?: any) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        })
      });
    } catch (e) {}
  };

  const sendTelegramMessage = async (chatId: number, text: string, token: string, replyMarkup?: any): Promise<any> => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        })
      });

      if (!res.ok) {
        // Fallback retry without Markdown parsing in case of invalid Markdown entities
        const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatId, 
            text: text.replace(/[*_`[\]]/g, ''),
            reply_markup: replyMarkup
          })
        });
        return await retryRes.json();
      }
      return await res.json();
    } catch (e) {
      console.error("Failed to send Telegram message:", e);
      return null;
    }
  };

  globalHandleUpdate = handleUpdate;
  poll();
  console.log("[TELEGRAM BOT] Background service initialized!");
}
