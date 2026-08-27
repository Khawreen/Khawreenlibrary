import React from 'react';

interface PublishGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GuideStep: React.FC<{ icon: string; title: string; children: React.ReactNode; }> = ({ icon, title, children }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
            <i className={`fas ${icon} text-xl text-indigo-600 dark:text-indigo-400`}></i>
        </div>
        <div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h4>
            <p className="text-slate-600 dark:text-slate-300">{children}</p>
        </div>
    </div>
);


const PublishGuideModal: React.FC<PublishGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-75 z-[100] flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-guide-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-2xl transform transition-all duration-300 ease-out animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
          <h2 id="publish-guide-title" className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
            <i className="fas fa-rocket"></i>
            Website Deployment Guide
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        <div className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                 <p className="text-center text-slate-700 dark:text-slate-200">
                    Your website uses a modern architecture ready for direct deployment. You can host your files online instantly!
                    <br />
                    The easiest free method is using <strong className="text-indigo-600 dark:text-indigo-400">Netlify Drop</strong>.
                 </p>
            </div>

            <GuideStep icon="fa-folder" title="Step 1: Prepare Your Files">
                Ensure all your project files and folders are together in one directory, including <code>index.html</code>, <code>index.tsx</code>, <code>App.tsx</code>, <code>styles.css</code>, and the <code>components</code> directory.
            </GuideStep>

            <GuideStep icon="fa-globe" title="Step 2: Go to Netlify Drop">
                Open your browser and navigate to:
                <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline ml-2">
                    app.netlify.com/drop
                </a>
            </GuideStep>

             <GuideStep icon="fa-hand-pointer" title="Step 3: Drag & Drop Your Folder">
                Drag the folder containing all your files into the Netlify Drop area. Netlify will deploy your site and give you a live URL.
             </GuideStep>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/40 border-l-4 border-amber-400 dark:border-amber-500">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <i className="fas fa-exclamation-triangle text-amber-500 dark:text-amber-400 text-xl"></i>
                    </div>
                    <div className="ml-3">
                        <h4 className="font-bold text-lg text-amber-800 dark:text-amber-200">Important: Enable AI Features</h4>
                        <div className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-2">
                            <p>To enable AI features (such as AI summaries and AI chatbot), configure your Google AI API key:</p>
                            <ol className="list-decimal list-inside pl-2 space-y-1">
                                <li>In Netlify, go to <strong>Site configuration / settings</strong>.</li>
                                <li>Navigate to <strong>Build & deploy</strong> → <strong>Post processing</strong>.</li>
                                <li>Under <strong>Snippet injection</strong>, click <strong>Add snippet</strong>.</li>
                                <li>Paste the snippet below and replace <code>YOUR_API_KEY_HERE</code> with your key:</li>
                            </ol>
                            <pre className="bg-slate-800 dark:bg-black/50 text-white dark:text-slate-200 p-3 rounded-md text-xs whitespace-pre-wrap">
                                <code>
    {`<script>
      window.process = { env: { API_KEY: "YOUR_API_KEY_HERE" } };
    <\/script>`}
                                </code>
                            </pre>
                            <p>Choose <strong>Insert before `&lt;/head&gt;`</strong> and click <strong>Save</strong>.</p>
                        </div>
                    </div>
                </div>
            </div>

             <GuideStep icon="fa-check-circle" title="Step 4: All Done!">
                Congratulations, your library website is live with all features enabled! You can now share your site link.
             </GuideStep>
        </div>

        <div className="mt-8 border-t pt-4 border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 transition-all duration-300"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishGuideModal;