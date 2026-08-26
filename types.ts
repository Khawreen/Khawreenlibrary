

export enum Section {
  Register = 'register',
  Login = 'login',
  Upload = 'upload',
  Books = 'books',
  Admin = 'admin',
  MyBooks = 'my-books',
  AdsManager = 'ads-manager',
  ForgotPassword = 'forgot-password',
  MyPurchases = 'my-purchases',
  Orders = 'orders',
  Settings = 'settings',
  Profile = 'profile',
}

export interface User {
  username: string; // This will be the user's email
  name: string;
  email: string;
  password?: string; // Hashed with PBKDF2-SHA512 + cryptographically secure salt
  role: 'admin' | 'user';
  purchasedBookIds: string[];
  telegramId?: number | string;
  telegramUsername?: string;
  createdAt?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  coverUrl: string;     // URL or Base64 Data URL
  pdfUrl: string;       // URL or Base64 Data URL
  pdfFileName: string;  // Store original PDF file name
  uploadedBy: string;   // user email
  status: 'pending' | 'approved';
  isForSale: boolean;
  price: number;
  tags: string[];
  downloadCount: number;
  isFeatured?: boolean;
}

export interface Review {
  id: string;
  bookId: string;
  username: string; // user email
  rating: number; // 1-5
  comment: string;
  createdAt: number; // timestamp
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum PaymentMethod {
  DirectTransfer = 'direct_transfer',
  HesabPay = 'hesabpay',
  TelegramStars = 'telegram_stars',
  Tonkeeper = 'tonkeeper',
}

export interface Purchase {
  id: string;
  bookId: string;
  userId: string; // user email
  amount: number;
  referenceCode: string;
  status: 'pending' | 'completed';
  paymentMethod: PaymentMethod | null;
  createdAt: number;
  cryptoTxHash?: string;
  telegramStarsPaymentId?: string;
  receiptUrl?: string;
  payerContact?: string;
  notes?: string;
}

export interface TelegramUser {
  id: string;
  telegramId: number;
  chatId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  firstSeen: number;
  lastActive: number;
  messagesCount: number;
}

export interface Settings {
  id: string; // Should be a singleton document ID, e.g., 'main'
  whatsappNumber?: string;
  telegramAdminUsername?: string;
  bankAccountDetails?: string;
  hesabpayMerchantId: string;
  hesabpayApiKey: string;
  hesabpaySandboxMode: boolean;
  usdtTrc20Address?: string;
  tonWalletAddress?: string;
  telegramBotToken?: string;
  telegramPaymentProviderToken?: string;
  nowpaymentsApiKey?: string;
  websiteUrl?: string;
}