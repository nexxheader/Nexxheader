import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ApiKeySelector } from './components/ApiKeySelector';
import { generateQuestions, synthesizePrompt, generateImage, generateVideo } from './services/geminiService';
import type { Question, AppStep, GenerationType, AspectRatio } from './types';
import { IMAGE_ASPECT_RATIOS, VIDEO_ASPECT_RATIOS } from './constants';

// --- Helper Functions ---

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};


// --- Step Components ---

interface IdeaInputProps {
    initialIdea: string;
    onIdeaChange: (value: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    referenceImages: string[];
    onImagesUpload: (base64s: string[]) => void;
    onImageRemove: (index: number) => void;
}

const IdeaInput: React.FC<IdeaInputProps> = ({ initialIdea, onIdeaChange, onSubmit, isLoading, referenceImages, onImagesUpload, onImageRemove }) => {
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            // FIX: Use spread syntax to convert FileList to an array. This addresses a type inference issue where Array.from() was resulting in 'unknown' type for array elements.
            const base64Promises = [...files].map(file => fileToBase64(file));
            const base64s = await Promise.all(base64Promises);
            onImagesUpload(base64s);
            event.target.value = ''; // Reset file input
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-slate-100">Comienza con una idea simple.</h2>
            <p className="text-center text-slate-300 mb-8 max-w-xl mx-auto">No necesitas ser un experto. Solo danos tu chispa creativa y nuestra IA te guiará con preguntas inteligentes para construir un prompt detallado que dé vida a tu visión.</p>
            
            <textarea
                value={initialIdea}
                onChange={(e) => onIdeaChange(e.target.value)}
                placeholder="Ej: un perro verde, una ciudad futurista, un robot solitario en Marte..."
                className="w-full h-40 p-4 bg-slate-800 border-2 border-slate-600 rounded-lg text-lg text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-6"
            />

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <label className="block text-lg font-semibold text-slate-200 mb-2">Sube imágenes de referencia (Opcional)</label>
                
                {referenceImages.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-4">
                        {referenceImages.map((image, index) => (
                            <div key={index} className="relative group aspect-square">
                                <img src={image} alt={`Referencia ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                <button 
                                    onClick={() => onImageRemove(index)}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-lg"
                                    aria-label={`Eliminar imagen ${index + 1}`}
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="flex items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                            <p className="text-xs text-slate-500">PNG, JPG, WEBP (múltiples archivos)</p>
                        </div>
                        <input id="dropzone-file" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} multiple />
                    </label>
                </div> 
            </div>


            <button
                onClick={onSubmit}
                disabled={isLoading}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105"
            >
                {isLoading ? <LoadingSpinner /> : 'Iniciar Creación de Prompt'}
            </button>
        </div>
    );
};

interface QuestionnaireProps {
    questions: Question[];
    onAnswerChange: (id: string, option: string, isChecked: boolean) => void;
    onSubmit: () => void;
    isLoading: boolean;
    answers: Record<string, string[]>;
    additionalIdea: string;
    onAdditionalIdeaChange: (value: string) => void;
}

const Questionnaire: React.FC<QuestionnaireProps> = ({ questions, onAnswerChange, onSubmit, isLoading, answers, additionalIdea, onAdditionalIdeaChange }) => (
    <div className="w-full max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-slate-100">Refinemos tu idea.</h2>
        <p className="text-center text-slate-300 mb-8">Elige las opciones que mejor se ajusten a tu visión para crear un prompt más preciso.</p>
        <div className="space-y-6">
            {questions.map((q) => (
                <div key={q.id} className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <label className="block text-lg font-semibold text-slate-200 mb-4">{q.question}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((option) => (
                             <label key={option} className={`flex items-center p-3 rounded-md cursor-pointer transition-all duration-200 ${answers[q.id]?.includes(option) ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                <input
                                    type="checkbox"
                                    onChange={(e) => onAnswerChange(q.id, option, e.target.checked)}
                                    checked={answers[q.id]?.includes(option) || false}
                                    className="h-5 w-5 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 mr-3"
                                />
                                <span className="flex-1">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        <div className="mt-8 bg-slate-800 p-5 rounded-lg border border-slate-700">
             <label htmlFor="additional-idea" className="block text-lg font-semibold text-slate-200 mb-3">¿Tienes alguna otra idea para agregar?</label>
             <textarea
                id="additional-idea"
                value={additionalIdea}
                onChange={(e) => onAdditionalIdeaChange(e.target.value)}
                placeholder="Ej: que el cielo sea violeta, que el personaje lleve un sombrero..."
                className="w-full h-24 p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <button
            onClick={onSubmit}
            disabled={isLoading}
            className="mt-8 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105"
        >
            {isLoading ? <LoadingSpinner /> : 'Crear Mi Prompt'}
        </button>
    </div>
);

interface FinalPromptProps {
    finalPrompt: string;
    generationType: GenerationType;
    onGenerationTypeChange: (type: GenerationType) => void;
    aspectRatio: AspectRatio;
    onAspectRatioChange: (ratio: AspectRatio) => void;
    onGenerate: () => void;
    isLoading: boolean;
    isApiKeySelected: boolean;
    onKeySelected: () => void;
}

const FinalPrompt: React.FC<FinalPromptProps> = ({ finalPrompt, generationType, onGenerationTypeChange, aspectRatio, onAspectRatioChange, onGenerate, isLoading, isApiKeySelected, onKeySelected }) => (
    <div className="w-full max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-slate-100">¡Tu Prompt Profesional está listo!</h2>
        <div className="bg-slate-800 p-6 rounded-lg border-2 border-blue-500 mb-8 prose prose-invert max-w-none text-lg">
            <p>{finalPrompt}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                    <label className="block text-lg font-semibold text-slate-200 mb-3">1. Elige el Tipo de Contenido</label>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => onGenerationTypeChange('IMAGE')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg transition-colors ${generationType === 'IMAGE' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                        >
                            Imagen
                        </button>
                        <button
                            onClick={() => onGenerationTypeChange('VIDEO')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg transition-colors ${generationType === 'VIDEO' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                        >
                            Video
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-lg font-semibold text-slate-200 mb-3">2. Selecciona la Proporción</label>
                    <select
                        value={aspectRatio}
                        onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:ring-2 focus:ring-blue-500"
                    >
                        {(generationType === 'IMAGE' ? IMAGE_ASPECT_RATIOS : VIDEO_ASPECT_RATIOS).map(ratio => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                    </select>
                </div>
            </div>
             {generationType === 'VIDEO' && <ApiKeySelector onKeySelected={onKeySelected} isKeySelected={isApiKeySelected} />}

            <button
                onClick={onGenerate}
                disabled={isLoading || (generationType === 'VIDEO' && !isApiKeySelected)}
                className="mt-8 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105"
            >
               {isLoading ? <LoadingSpinner /> : `Generar ${generationType === 'IMAGE' ? 'Imagen' : 'Video'}`}
            </button>
        </div>
    </div>
);

interface GenerationResultProps {
    resultData: string | null;
    generationType: GenerationType;
    onStartOver: () => void;
}

const GenerationResult: React.FC<GenerationResultProps> = ({ resultData, generationType, onStartOver }) => {
    const handleDownloadImage = () => {
        if (!resultData) return;
        const link = document.createElement('a');
        link.href = resultData;
        link.download = `nexxprompt-creacion.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full max-w-4xl mx-auto text-center">
             <h2 className="text-3xl font-bold text-slate-100 mb-6">¡Tu Creación está Aquí!</h2>
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-8 flex justify-center items-center relative">
                {resultData && generationType === 'IMAGE' && (
                    <img src={resultData} alt="Contenido generado" className="max-w-full max-h-[70vh] rounded-md" />
                )}
                {resultData && generationType === 'VIDEO' && (
                    <video controls src={resultData} className="max-w-full max-h-[70vh] rounded-md" />
                )}
            </div>
            
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                    onClick={onStartOver}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105"
                >
                    Crear Algo Nuevo
                </button>

                {generationType === 'IMAGE' && resultData && (
                    <button
                        onClick={handleDownloadImage}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105"
                    >
                        Descargar Imagen
                    </button>
                )}

                {generationType === 'VIDEO' && resultData && (
                    <a
                        href={resultData}
                        download="nexxprompt-creacion.mp4"
                        className="w-full sm:w-auto inline-block text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105"
                    >
                        Descargar Video
                    </a>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [step, setStep] = useState<AppStep>('IDEA');
    const [initialIdea, setInitialIdea] = useState<string>('');
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [additionalIdea, setAdditionalIdea] = useState<string>('');
    const [finalPrompt, setFinalPrompt] = useState<string>('');
    const [generationType, setGenerationType] = useState<GenerationType>('IMAGE');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [resultData, setResultData] = useState<string | null>(null);
    const [isApiKeySelected, setIsApiKeySelected] = useState(false);
    const [isEmbedded, setIsEmbedded] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === 'true') {
            setIsEmbedded(true);
        }
    }, []);


    useEffect(() => {
        if (generationType === 'IMAGE') {
            setAspectRatio('1:1');
        } else {
            setAspectRatio('16:9');
        }
    }, [generationType]);

    const handleIdeaSubmit = async () => {
        if (!initialIdea.trim() && referenceImages.length === 0) {
            setError('Por favor, ingresa una idea o sube una imagen para comenzar.');
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Generando preguntas para aclarar...');
        setError(null);
        setStep('QUESTIONS');

        try {
            const generatedQuestions = await generateQuestions(initialIdea, referenceImages);
            setQuestions(generatedQuestions);
        } catch (err) {
            console.error(err);
            setError('Error al generar las preguntas. Por favor, intenta de nuevo.');
            setStep('IDEA');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswersSubmit = async () => {
        setIsLoading(true);
        setLoadingMessage('Creando el prompt perfecto...');
        setError(null);
        setStep('PROMPT');
        
        try {
            const synthesizedPrompt = await synthesizePrompt(initialIdea, questions, answers, referenceImages, additionalIdea);
            setFinalPrompt(synthesizedPrompt);
        } catch (err) {
            console.error(err);
            setError('Error al crear el prompt final. Por favor, intenta de nuevo.');
            setStep('QUESTIONS');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateContent = async () => {
        setIsLoading(true);
        setError(null);
        setStep('GENERATING');
        setResultData(null);

        try {
            if (generationType === 'IMAGE') {
                setLoadingMessage('Generando tu obra maestra...');
                const imageUrl = await generateImage(finalPrompt, aspectRatio);
                setResultData(imageUrl);
            } else {
                setLoadingMessage('Generando tu video... Esto puede tardar unos minutos. Por favor, espera.');
                const videoUrl = await generateVideo(finalPrompt, aspectRatio);
                setResultData(videoUrl);
            }
            setStep('RESULT');
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || 'Ocurrió un error inesperado durante la generación.';
            setError(`La generación de contenido falló. ${errorMessage}`);
            if (errorMessage.includes("Requested entity was not found")) {
                setError("Error de Clave API. Por favor, vuelve a seleccionar tu Clave API e intenta de nuevo.");
                setIsApiKeySelected(false);
            }
            setStep('PROMPT');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (id: string, option: string, isChecked: boolean) => {
        setAnswers(prev => {
            const newAnswers = { ...prev };
            const currentSelection = newAnswers[id] || [];
            
            if (isChecked) {
                // Add the option if it's not already there
                if (!currentSelection.includes(option)) {
                    newAnswers[id] = [...currentSelection, option];
                }
            } else {
                // Remove the option
                newAnswers[id] = currentSelection.filter(item => item !== option);
            }
    
            return newAnswers;
        });
    };

    const handleStartOver = () => {
        setStep('IDEA');
        setInitialIdea('');
        setReferenceImages([]);
        setQuestions([]);
        setAnswers({});
        setAdditionalIdea('');
        setFinalPrompt('');
        setError(null);
        setResultData(null);
        setGenerationType('IMAGE');
        setAspectRatio('1:1');
    };
    
    const handleImagesUpload = (base64s: string[]) => {
        setReferenceImages(prev => [...prev, ...base64s]);
    };
    
    const handleImageRemove = (indexToRemove: number) => {
        setReferenceImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const renderStep = () => {
        if (isLoading && step !== 'IDEA' && step !== 'RESULT') {
             return <div className="text-center text-slate-200">
                <LoadingSpinner />
                <p className="text-xl mt-4 font-semibold">{loadingMessage}</p>
            </div>;
        }

        switch (step) {
            case 'IDEA': 
                return <IdeaInput 
                    initialIdea={initialIdea} 
                    onIdeaChange={setInitialIdea} 
                    onSubmit={handleIdeaSubmit} 
                    isLoading={isLoading} 
                    referenceImages={referenceImages}
                    onImagesUpload={handleImagesUpload}
                    onImageRemove={handleImageRemove}
                />;
            case 'QUESTIONS': 
                return <Questionnaire 
                    questions={questions}
                    onAnswerChange={handleAnswerChange}
                    onSubmit={handleAnswersSubmit}
                    isLoading={isLoading}
                    answers={answers}
                    additionalIdea={additionalIdea}
                    onAdditionalIdeaChange={setAdditionalIdea}
                />;
            case 'PROMPT': 
                return <FinalPrompt 
                    finalPrompt={finalPrompt}
                    generationType={generationType}
                    onGenerationTypeChange={setGenerationType}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    onGenerate={handleGenerateContent}
                    isLoading={isLoading}
                    isApiKeySelected={isApiKeySelected}
                    onKeySelected={() => setIsApiKeySelected(true)}
                />;
            case 'RESULT': 
                return <GenerationResult 
                    resultData={resultData}
                    generationType={generationType}
                    onStartOver={handleStartOver}
                />;
            default: 
                return <IdeaInput 
                    initialIdea={initialIdea} 
                    onIdeaChange={setInitialIdea} 
                    onSubmit={handleIdeaSubmit} 
                    isLoading={isLoading}
                    referenceImages={referenceImages}
                    onImagesUpload={handleImagesUpload}
                    onImageRemove={handleImageRemove}
                />;
        }
    };

    const containerClass = isEmbedded 
        ? '' 
        : 'min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8';

    return (
        <div className={containerClass}>
            {!isEmbedded && <Header />}
            <main className="container mx-auto mt-10">
                {error && <div className="bg-red-500 border border-red-700 text-white p-4 rounded-lg mb-6 max-w-3xl mx-auto text-center">{error}</div>}
                {renderStep()}
            </main>
        </div>
    );
};

export default App;
