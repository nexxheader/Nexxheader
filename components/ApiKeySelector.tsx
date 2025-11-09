import React, { useState, useEffect, useCallback } from 'react';

interface ApiKeySelectorProps {
    onKeySelected: () => void;
    isKeySelected: boolean;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected, isKeySelected }) => {
    const [showSelector, setShowSelector] = useState(false);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (hasKey) {
                onKeySelected();
            } else {
                setShowSelector(true);
            }
        }
    }, [onKeySelected]);

    useEffect(() => {
        if (!isKeySelected) {
            checkApiKey();
        }
    }, [isKeySelected, checkApiKey]);


    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success and optimistically update UI
            onKeySelected();
            setShowSelector(false);
        }
    };
    
    if (isKeySelected) {
        return (
             <div className="mt-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-center">
                <p className="text-green-300 font-semibold">✓ La Clave API está lista para la generación de video.</p>
            </div>
        )
    }

    if (showSelector) {
        return (
            <div className="mt-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-center">
                <p className="mb-3 text-blue-200">La generación de video requiere una Clave API. Por favor, selecciona una clave para continuar. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-100">Aprende sobre la facturación</a>.</p>
                <button
                    onClick={handleSelectKey}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-md transition-colors"
                >
                    Seleccionar Clave API
                </button>
            </div>
        );
    }

    return null;
};