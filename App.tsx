
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DownloadIcon, SpinnerIcon, UploadIcon, TrashIcon } from './components/icons';

// Declare global variables from CDN scripts for TypeScript
declare global {
    interface Window {
        marked: {
            parse: (markdown: string, options?: object) => Promise<string>;
        };
        DOMPurify: {
            sanitize: (html: string) => string;
        };
        jspdf: {
            jsPDF: any;
        };
        JSZip: any;
    }
}

interface UploadedFile {
    id: string;
    name: string;
    content: string;
}

const MAX_FILES = 100;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_ZIP_FILE_SIZE_MB = 25;
const MAX_ZIP_FILE_SIZE_BYTES = MAX_ZIP_FILE_SIZE_MB * 1024 * 1024;

/**
 * Converts CSV string to a Markdown table.
 * @param csv The string content of a CSV file.
 * @returns A string formatted as a Markdown table.
 */
const csvToMarkdownTable = (csv: string): string => {
    const content = csv.trim();
    if (!content) return '';
    
    const parseCsvRow = (row: string): string[] => {
        const results = [];
        let currentMatch = '';
        const regex = /(?:"((?:""|[^"])*)"|([^,]*))(,|$)/g;
        let match;
        while ((match = regex.exec(row))) {
            let value = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
            results.push(value.trim());
            if (match[3] === '') break;
        }
        return results;
    };

    const lines = content.split(/\r?\n/);
    if (lines.length === 0) return '';
    
    const header = parseCsvRow(lines[0]);
    const separator = header.map(() => '---').join(' | ');
    
    const rows = lines.slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
            const cells = parseCsvRow(line);
            const adjustedCells = Array.from({ length: header.length }, (_, i) => cells[i] || '');
            return adjustedCells.map(cell => cell.replace(/\|/g, '\\|')).join(' | ');
        })
        .map(row => `| ${row} |`)
        .join('\n');

    return `| ${header.join(' | ')} |\n| ${separator} |\n${rows}`;
};

const App: React.FC = () => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [sanitizedHtmlPreview, setSanitizedHtmlPreview] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isJoining, setIsJoining] = useState<boolean>(true);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const sanitizeFilenameForHeader = (name: string) => {
        const extensionless = name.replace(/\.(md|markdown|csv)$/i, '');
        return extensionless.replace(/([\\`*_{}[\]()#+-.!])/g, '\\$1');
    };

    const combinedMarkdown = useMemo(() => {
        if (!isJoining || files.length === 0) return '';
        return files.map(file => `# ${sanitizeFilenameForHeader(file.name)}\n\n${file.content}`).join('\n\n---\n\n');
    }, [files, isJoining]);

    useEffect(() => {
        const updatePreview = async () => {
            if (window.marked && combinedMarkdown) {
                const rawHtml = await window.marked.parse(combinedMarkdown, { gfm: true, breaks: true });
                setSanitizedHtmlPreview(window.DOMPurify.sanitize(rawHtml));
            } else {
                setSanitizedHtmlPreview('');
            }
        };
        updatePreview();
    }, [combinedMarkdown]);

    const processFiles = useCallback(async (droppedFiles: File[]) => {
        setError(null);
        if (files.length >= MAX_FILES) {
            setError(`You have reached the maximum of ${MAX_FILES} files.`);
            return;
        }

        setStatusMessage('Processing files...');
        setIsLoading(true);

        const processSingleFile = (fileName: string, content: string): UploadedFile => {
            let processedContent = content;
            if (/\.csv$/i.test(fileName)) {
                processedContent = csvToMarkdownTable(content);
            }
            return {
                id: `${fileName}-${Date.now()}-${Math.random()}`,
                name: fileName,
                content: processedContent
            };
        };

        const handleFile = (file: File): Promise<UploadedFile[]> => {
            return new Promise(async (resolve, reject) => {
                if (/\.zip$/i.test(file.name)) {
                    if (file.size > MAX_ZIP_FILE_SIZE_BYTES) {
                        return reject(new Error(`ZIP "${file.name}" is larger than ${MAX_ZIP_FILE_SIZE_MB}MB.`));
                    }
                    if (!window.JSZip) {
                        return reject(new Error("ZIP library not loaded. Please refresh."));
                    }
                    try {
                        const zip = await window.JSZip.loadAsync(file);
                        const filePromises = Object.values(zip.files)
                            // FIX: Explicitly type zipEntry as 'any' to resolve TypeScript errors about accessing properties on an 'unknown' type.
                            .filter((zipEntry: any) => !zipEntry.dir && /\.(md|markdown|csv)$/i.test(zipEntry.name))
                            // FIX: Explicitly type zipEntry as 'any' to resolve TypeScript errors about accessing properties on an 'unknown' type.
                            .map(async (zipEntry: any) => {
                                const content = await zipEntry.async('string');
                                return processSingleFile(zipEntry.name, content);
                            });
                        
                        const filesFromZip = await Promise.all(filePromises);
                        resolve(filesFromZip);
                    } catch (e) {
                        reject(new Error(`Failed to process ZIP file "${file.name}". It may be corrupt.`));
                    }
                } else if (/\.(md|markdown|csv)$/i.test(file.name)) {
                    if (file.size > MAX_FILE_SIZE_BYTES) {
                        return reject(new Error(`"${file.name}" is larger than ${MAX_FILE_SIZE_MB}MB.`));
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const content = event.target?.result as string;
                            resolve([processSingleFile(file.name, content)]);
                        } catch (err) {
                            reject(new Error(`Failed to process "${file.name}".`));
                        }
                    };
                    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
                    reader.readAsText(file);
                } else {
                    resolve([]); // Silently ignore unsupported file types
                }
            });
        };

        try {
            const promises = Array.from(droppedFiles).map(handleFile);
            const nestedNewFiles = await Promise.all(promises);
            const newFiles = nestedNewFiles.flat();

            if (files.length + newFiles.length > MAX_FILES) {
                setError(`Adding these files would exceed the limit of ${MAX_FILES}. Only a portion were added.`);
                const spaceLeft = MAX_FILES - files.length;
                setFiles(currentFiles => [...currentFiles, ...newFiles.slice(0, spaceLeft)]);
            } else {
                setFiles(currentFiles => [...currentFiles, ...newFiles]);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(message);
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    }, [files.length]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };
    
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };
    
    const removeFile = (fileId: string) => {
        setFiles(files => files.filter(file => file.id !== fileId));
    };

    const handleDownload = useCallback(async () => {
        setError(null);
        if (files.length === 0) {
            setError("Please upload some files first.");
            return;
        }
        
        if (!window.jspdf || !window.marked || !window.DOMPurify || !window.JSZip) {
            setError("Core libraries failed to load. Please refresh the page and try again.");
            return;
        }
        
        setIsLoading(true);

        const { jsPDF } = window.jspdf;
        const { marked } = window;
        const DOMPurify = window.DOMPurify;

        const createPdf = async (markdownContent: string, title: string): Promise<any> => {
            const rawHtml = await marked.parse(markdownContent, { gfm: true, breaks: true });
            const sanitizedHtml = DOMPurify.sanitize(rawHtml);
            const styles = `body{font-family:'Helvetica','sans-serif';line-height:1.6;color:#1f2937}h1{font-size:24pt;font-weight:700;margin-bottom:16pt;border-bottom:1px solid #d1d5db;padding-bottom:8pt;color:#111827}h2{font-size:20pt;font-weight:700;margin-bottom:12pt;border-bottom:1px solid #e5e7eb;padding-bottom:6pt;color:#111827}h3{font-size:16pt;font-weight:700;margin-bottom:10pt;color:#1f2937}p,ul,ol,blockquote{margin-bottom:12pt}ul,ol{padding-left:20pt}li{margin-bottom:4pt}code{font-family:'Courier New',Courier,monospace;background-color:#f3f4f6;padding:2pt 4pt;border-radius:4px;font-size:85%;color:#374151}pre{background-color:#f3f4f6;padding:12pt;border-radius:6px;overflow:auto;margin-bottom:16pt}pre code{padding:0;background-color:transparent}blockquote{color:#4b5563;border-left:4px solid #d1d5db;padding-left:16pt;margin-left:0;font-style:italic}a{color:#2563eb;text-decoration:none}hr{border-top:1px solid #d1d5db;margin:2rem 0}table{border-collapse:collapse;width:100%;margin-bottom:1rem}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background-color:#f3f4f6;font-weight:bold}`;
            const fullHtml = `<html><head><meta charset="UTF-8"><style>${styles}</style></head><body>${sanitizedHtml}</body></html>`;
            
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            
            doc.setDocumentProperties({
                title: title,
                author: 'RAG-Optimized PDF Converter',
                keywords: 'Markdown, PDF, RAG, Gemini API, CSV',
                creator: 'RAG-Optimized PDF Converter'
            });

            return doc.html(fullHtml, { margin: [40, 40, 40, 40], autoPaging: 'text', width: 515, windowWidth: 700 });
        };

        try {
            if (isJoining) {
                setStatusMessage("Generating combined PDF...");
                const doc = await createPdf(combinedMarkdown, 'RAG-Optimized Document');
                doc.save('rag-combined.pdf');
            } else {
                const zip = new window.JSZip();
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setStatusMessage(`Generating PDF ${i + 1}/${files.length}...`);
                    const title = file.name.replace(/\.(md|markdown|csv)$/i, '');
                    const doc = await createPdf(file.content, title);
                    const pdfBlob = doc.output('blob');
                    zip.file(`${title}.pdf`, pdfBlob);
                }
                setStatusMessage('Creating ZIP file...');
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = 'rag-pdfs.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
        } catch (err) {
            console.error("Failed to generate output:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(`Failed to generate output: ${message}`);
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    }, [files, isJoining, combinedMarkdown]);

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
            <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-md flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-cyan-400"><path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a.375.375 0 0 1-.375-.375V6.75A3.75 3.75 0 0 0 10.5 3H5.625Z M10.5 10.5a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5Z" /><path d="M12.47 6.112a.75.75 0 0 0-1.06 1.06l3.611 3.612a.75.75 0 0 0 1.06-1.06l-3.61-3.612Z" /></svg>
                    <h1 className="text-xl font-bold text-white tracking-wide">MD/CSV to RAG-Optimized PDF</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center cursor-pointer">
                        <span className="mr-3 text-sm font-medium">Combine into single PDF</span>
                        <div className="relative">
                            <input type="checkbox" checked={isJoining} onChange={() => setIsJoining(!isJoining)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                        </div>
                    </label>
                     <button
                        onClick={handleDownload}
                        disabled={isLoading || files.length === 0}
                        className="flex items-center justify-center w-48 px-4 py-2 font-semibold text-white bg-cyan-600 rounded-lg shadow-md hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        {isLoading ? (
                            <>
                                <SpinnerIcon />
                                {statusMessage || 'Processing...'}
                            </>
                        ) : (
                            <>
                                <DownloadIcon />
                                {isJoining ? 'Download PDF' : 'Download as ZIP'}
                            </>
                        )}
                    </button>
                </div>
            </header>
            <main className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">
                <div className="flex flex-col h-full gap-4">
                     <div 
                        className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${isDragging ? 'border-cyan-400 bg-gray-700' : 'border-gray-600 hover:border-gray-500 bg-gray-800'}`}
                        onDragEnter={handleDragEvents} onDragOver={handleDragEvents} onDragLeave={handleDragEvents} onDrop={handleDrop}
                     >
                        <input type="file" id="file-upload" multiple accept=".md,.markdown,.csv,.zip" className="hidden" onChange={handleFileChange} />
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                            <UploadIcon />
                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-gray-500">MD, CSV, or ZIP files (Max {MAX_FILE_SIZE_MB}MB per file)</p>
                        </label>
                    </div>
                     {error && (
                        <div className="p-3 text-sm text-red-300 bg-red-900/50 border border-red-500/50 rounded-lg" role="alert">
                           <span className="font-medium">Error:</span> {error}
                        </div>
                    )}
                    <div className="flex flex-col flex-grow h-0 bg-gray-800 border border-gray-700 rounded-lg">
                        <div className="flex justify-between items-center p-3 border-b border-gray-700">
                            <h2 className="font-semibold">Files ({files.length}/{MAX_FILES})</h2>
                            <button onClick={() => setFiles([])} disabled={files.length === 0} className="text-sm text-cyan-400 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed">Clear All</button>
                        </div>
                        <div className="overflow-y-auto p-2">
                           {files.length === 0 ? (
                                <p className="text-center text-gray-500 p-4">Upload files to see them here.</p>
                           ) : (
                               <ul>
                                   {files.map((file) => (
                                       <li key={file.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700">
                                            <span className="text-sm truncate" title={file.name}>{file.name}</span>
                                            <button onClick={() => removeFile(file.id)} className="text-gray-500 hover:text-red-400"><TrashIcon /></button>
                                       </li>
                                   ))}
                               </ul>
                           )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col h-full overflow-hidden">
                    <label className="text-sm font-medium text-gray-400 mb-2">
                        {isJoining ? 'Combined Preview' : 'Preview Disabled'}
                    </label>
                    <div
                        className="w-full h-full p-6 bg-gray-800 border border-gray-700 rounded-lg overflow-y-auto 
                                   prose prose-invert prose-sm max-w-none 
                                   prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-gray-600
                                   prose-h2:text-xl prose-h2:font-bold prose-h2:mb-3 prose-h2:pb-1 prose-h2:border-b prose-h2:border-gray-700
                                   prose-h3:text-lg prose-h3:font-bold prose-h3:mb-2
                                   prose-p:mb-4 prose-p:leading-relaxed
                                   prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                                   prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                                   prose-li:mb-1
                                   prose-code:bg-gray-700 prose-code:rounded prose-code:px-1.5 prose-code:py-1 prose-code:font-mono prose-code:text-sm prose-code:text-cyan-300
                                   prose-pre:bg-gray-900 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:mb-4
                                   prose-blockquote:border-l-4 prose-blockquote:border-gray-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-400
                                   prose-a:text-cyan-400 prose-a:underline hover:prose-a:text-cyan-300
                                   prose-table:w-full prose-table:border-collapse prose-table:mb-4
                                   prose-th:border prose-th:border-gray-600 prose-th:px-4 prose-th:py-2 prose-th:bg-gray-700 prose-th:font-bold
                                   prose-td:border prose-td:border-gray-600 prose-td:px-4 prose-td:py-2"
                    >
                     {isJoining && files.length > 0 ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizedHtmlPreview }} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>{isJoining ? "Upload files to see a combined preview." : "Preview is only available when combining files."}</p>
                        </div>
                    )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;