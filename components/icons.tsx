import React from 'react';

export const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

export const SpinnerIcon: React.FC = () => (
    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const UploadIcon: React.FC = () => (
    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
    </svg>
);

export const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export const WizardHatIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-cyan-400">
        <style>{`
            .hat-float {
                animation: float 3s ease-in-out infinite;
            }
            .sparkle-fade {
                animation: fade 2.5s ease-in-out infinite;
                transform-origin: center;
            }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-3px); }
                100% { transform: translateY(0px); }
            }
            @keyframes fade {
                0%, 100% { opacity: 0; transform: scale(0.5); }
                50% { opacity: 1; transform: scale(1); }
            }
        `}</style>
        <g className="hat-float">
            <path d="M21.5,17.5H2.5a.5.5,0,0,1,0-1h19a.5.5,0,0,1,0,1Z"/>
            <path d="M12.44,2.25a.5.5,0,0,0-.88,0L3.34,17h17.32L12.44,2.25ZM12,4.69,15.7,16H8.3Z"/>
        </g>
        <path className="sparkle-fade" fill="#FFD700" d="M18.5 6.5L18 8l-1.5-0.5L16 9l-0.5-1.5L14 7l1.5-0.5L16 5l0.5 1.5L18.5 6.5z" style={{ animationDelay: '0.5s' }} />
    </svg>
);

export const SparklesIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m11-1V7a2 2 0 00-2-2h-1a2 2 0 00-2 2v1h-3a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-1a2 2 0 00-2-2h-1z" />
    </svg>
);