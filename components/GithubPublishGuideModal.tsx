import React from 'react';

interface GithubPublishGuideModalProps {
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


const GithubPublishGuideModal: React.FC<GithubPublishGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-75 z-[100] flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-publish-guide-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-2xl transform transition-all duration-300 ease-out animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
          <h2 id="github-publish-guide-title" className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
            <i className="fa-brands fa-github"></i>
            GitHub Pages Publishing Guide
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        <div className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                 <p className="text-center text-slate-700 dark:text-slate-200">
                    Your website is designed for quick deployment. You can upload all your files directly to GitHub and publish them for free using <strong>GitHub Pages</strong>.
                 </p>
            </div>

            <GuideStep icon="fa-user-plus" title="Step 1: Create GitHub Account & Repository">
                If you don't have an account, create one at <a href="https://github.com/join" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">github.com</a>. Then, create a new public repository with any name you choose.
            </GuideStep>

            <GuideStep icon="fa-key" title="Step 2: Add API Key (Important)">
                Before uploading, open <strong>index.html</strong> in a code editor. Right before the <code>&lt;/head&gt;</code> line, add the following script and replace <code>YOUR_API_KEY_HERE</code> with your Google AI API key:
                <pre className="mt-2 bg-slate-800 dark:bg-black/50 text-white dark:text-slate-200 p-3 rounded-md text-xs whitespace-pre-wrap">
                    <code>
        {`<script>
          window.process = { env: { API_KEY: "YOUR_API_KEY_HERE" } };
        <\/script>`}
                    </code>
                </pre>
                This will enable all AI features on your live website.
            </GuideStep>

            <GuideStep icon="fa-upload" title="Step 3: Upload Your Files">
                In your new repository, click the <strong>"Add file"</strong> button and select <strong>"Upload files"</strong>. Drag and drop all your project files and folders (e.g., <code>index.html</code>, <code>components</code> folder, etc.).
            </GuideStep>

             <GuideStep icon="fa-cog" title="Step 4: Go to Repository Settings">
                Once files are uploaded and committed, click the <strong>"Settings"</strong> tab at the top of your repository.
             </GuideStep>

             <GuideStep icon="fa-file-lines" title="Step 5: Navigate to Pages">
                In the left sidebar menu, click on <strong>"Pages"</strong>.
             </GuideStep>

             <GuideStep icon="fa-code-branch" title="Step 6: Select Branch Source">
                Under "Build and deployment", select <strong>"Deploy from a branch"</strong> as the Source. Under "Branch", select your main branch (typically <code>main</code> or <code>master</code>) and leave folder as <code>/(root)</code>. Click <strong>Save</strong>.
             </GuideStep>

             <GuideStep icon="fa-check-circle" title="Step 7: Your Site is Live!">
                Within a few minutes, GitHub Pages will deploy your library online. You will find your live link at the top of the Pages settings page!
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

export default GithubPublishGuideModal;