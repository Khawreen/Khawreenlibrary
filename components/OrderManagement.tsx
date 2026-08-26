import React from 'react';
import { Purchase, Book, User } from '../types';

interface OrderManagementProps {
  purchases: Purchase[];
  books: Book[];
  users: User[];
  onApproveOrder?: (purchaseId: string) => void;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ purchases, books, users, onApproveOrder }) => {

  const bookMap = React.useMemo(() => 
    new Map(books.map(book => [book.id, book.title])),
    [books]
  );
  
  const userMap = React.useMemo(() => 
    new Map(users.map(user => [user.username, { name: user.name, email: user.email }])),
    [users]
  );

  const getBookTitle = (bookId: string) => bookMap.get(bookId) || 'Unknown Book';
  const getUserName = (userId: string) => userMap.get(userId)?.name || 'Unknown User';
  const getUserEmail = (userId: string) => userMap.get(userId)?.email || 'N/A';

  const pendingPurchases = purchases.filter(p => p.status === 'pending').sort((a,b) => b.createdAt - a.createdAt);
  const completedPurchases = purchases.filter(p => p.status === 'completed').sort((a,b) => b.createdAt - a.createdAt);

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return 'Pending Choice';
    switch (method) {
      case 'direct_transfer': return 'Sarafi Transfer & Bank Account (Direct)';
      case 'hesabpay': return 'HesabPay (Automated)';
      case 'telegram_stars': return 'Telegram Stars (Automated)';
      case 'tonkeeper': return 'Tonkeeper / Web3 Crypto (Auto)';
      default: return method.charAt(0).toUpperCase() + method.slice(1);
    }
  };

  const renderPurchaseRow = (purchase: Purchase, isPending: boolean) => (
      <div key={purchase.id} className={`p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isPending ? 'bg-white dark:bg-slate-800 border-amber-300/50' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
        <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-base">{getBookTitle(purchase.bookId)}</p>
              <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded">
                {purchase.amount} AFN
              </span>
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400">
                <span>User: <strong className="text-slate-700 dark:text-slate-200">{getUserName(purchase.userId)}</strong> ({getUserEmail(purchase.userId)})</span>
                {purchase.payerContact && (
                  <span className="mr-3 font-semibold text-emerald-600 dark:text-emerald-400">
                    <i className="fas fa-phone-alt ml-1"></i> Contact: {purchase.payerContact}
                  </span>
                )}
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                <span>Ref Code: <strong className="font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-xs">{purchase.referenceCode}</strong></span>
                <span>Gateway: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{getPaymentMethodLabel(purchase.paymentMethod)}</strong></span>
            </div>

            {purchase.notes && (
              <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-200">
                <i className="fas fa-sticky-note mr-1 text-amber-500"></i> {purchase.notes}
              </div>
            )}

            {/* If Receipt is uploaded */}
            {purchase.receiptUrl && (
              <div className="pt-1">
                <a 
                  href={purchase.receiptUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800"
                >
                  <i className="fas fa-image"></i> View Payment Receipt
                </a>
              </div>
            )}

            {/* If Crypto TX hash is attached */}
            {purchase.cryptoTxHash && (
              <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 truncate max-w-md">
                <i className="fas fa-link mr-1"></i> TX: {purchase.cryptoTxHash}
              </div>
            )}

            <div className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(purchase.createdAt).toLocaleString()}
            </div>
        </div>

        <div className="flex-shrink-0 self-end md:self-center flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {isPending ? (
              <>
                {onApproveOrder && (
                  <button
                    onClick={() => onApproveOrder(purchase.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
                  >
                    <i className="fas fa-check-circle"></i> Approve & Unlock Book
                  </button>
                )}
                <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                    <i className="fas fa-hourglass-half animate-spin"></i> Pending
                </span>
              </>
            ) : (
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 dark:bg-green-900/50 dark:text-green-300">
                  <i className="fas fa-check-circle"></i> Completed
              </span>
            )}
        </div>
      </div>
  );

  return (
    <>
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center gap-3">
        <i className="fas fa-receipt"></i>
        Orders Management
      </h2>
      
      <div className="space-y-6">
        <div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Pending & In-Progress ({pendingPurchases.length})</h3>
            {pendingPurchases.length > 0 ? (
                <div className="space-y-4">
                    {pendingPurchases.map(p => renderPurchaseRow(p, true))}
                </div>
            ) : (
                <p className="text-slate-500 dark:text-slate-400 text-center py-5">No pending orders.</p>
            )}
        </div>
        <div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Completed Orders ({completedPurchases.length})</h3>
             {completedPurchases.length > 0 ? (
                <div className="space-y-4">
                    {completedPurchases.map(p => renderPurchaseRow(p, false))}
                </div>
            ) : (
                <p className="text-slate-500 dark:text-slate-400 text-center py-5">No completed orders yet.</p>
            )}
        </div>
      </div>
    </>
  );
};

export default OrderManagement;