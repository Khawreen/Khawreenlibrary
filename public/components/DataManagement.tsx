import React, { useState, useRef } from 'react';

interface DataManagementProps {
  onExport: () => void;
  onImport: (file: File) => void;
  isExporting: boolean;
  isImporting: boolean;
}

const DataManagement: React.FC<DataManagementProps> = ({ onExport, onImport, isExporting, isImporting }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImportClick = () => {
    if (selectedFile) {
      if (window.confirm('Are you sure you want to import this data? This will ERASE all data currently in this browser and replace it. This action cannot be undone.')) {
        onImport(selectedFile);
      }
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-3">
        <i className="fas fa-database"></i>
        Data Management
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm sm:text-base">
        Your library data (books, user accounts, etc.) is stored locally in this web browser. Use the options below to back up your data to a file or restore it in a different browser or on a new device.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Section */}
        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <i className="fas fa-file-export text-emerald-500"></i>
            Export Data
          </h3>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Download a single JSON file containing all your library data. Keep this file in a safe place.
          </p>
          <button
            onClick={onExport}
            disabled={isExporting}
            className="w-full bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-slate-400 dark:disabled:bg-slate-600"
          >
            {isExporting ? (
              <><i className="fas fa-spinner fa-spin"></i> Exporting...</>
            ) : (
              <><i className="fas fa-download"></i> Download Backup File</>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <i className="fas fa-file-import text-sky-500"></i>
            Import Data
          </h3>
          <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-500/50">
             <p className="text-sm text-amber-800 dark:text-amber-200">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                <strong >Warning:</strong> Importing data will overwrite everything currently in your library.
             </p>
          </div>
          
          <div className="flex flex-col gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full text-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500"
              >
                {selectedFile ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold"><i className="fas fa-check-circle mr-2"></i>{selectedFile.name}</span>
                ) : (
                    <span className="text-slate-500 dark:text-slate-400"><i className="fas fa-upload mr-2"></i>Choose Backup File...</span>
                )}
              </button>

              <button
                onClick={handleImportClick}
                disabled={isImporting || !selectedFile}
                className="w-full bg-sky-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-slate-400 dark:disabled:bg-slate-600"
              >
                {isImporting ? (
                  <><i className="fas fa-spinner fa-spin"></i> Importing...</>
                ) : (
                  <><i className="fas fa-upload"></i> Import and Overwrite Data</>
                )}
              </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default DataManagement;
