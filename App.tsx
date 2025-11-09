
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ApiKeySelector } from './components/ApiKeySelector';
import { generateQuestions, synthesizePrompt, generateImage, generateVideo, refinePrompt } from './services/geminiService';
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
    referenceImage: string | null;
    onImageUpload: (base64: string) => void;
    onImageRemove: () => void;
}

const IdeaInput: React.FC<IdeaInputProps> = ({ initialIdea, onIdeaChange, onSubmit, isLoading, referenceImage, onImageUpload, onImageRemove }) => {
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            onImageUpload(base64);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-slate-100">Comienza con una idea simple.</h2>
            <p className="text-center text-slate-300 mb-8">Convirtamos tu concepto en una obra maestra. ¿Qué quieres crear?</p>
            
            <div className="mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
                <label htmlFor="image-upload" className="block text-lg font-semibold text-slate-200 mb-2">Sube una imagen de referencia (Opcional)</label>
                {referenceImage ? (
                    <div className="relative group">
                        <img src={referenceImage} alt="Referencia" className="w-40 h-40 object-cover rounded-md mx-auto" />
                        <button 
                            onClick={onImageRemove}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-8 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xl"
                            aria-label="Eliminar imagen"
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                <p className="text-xs text-slate-500">PNG, JPG, WEBP</p>
                            </div>
                            <input id="dropzone-file" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                        </label>
                    </div> 
                )}
            </div>

            <textarea
                value={initialIdea}
                onChange={(e) => onIdeaChange(e.target.value)}
                placeholder="Ej: un perro verde, una ciudad futurista, un robot solitario en Marte..."
                className="w-full h-32 p-4 bg-slate-800 border-2 border-slate-600 rounded-lg text-lg text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
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
    onAnswerChange: (id: string, value: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
}

const Questionnaire: React.FC<QuestionnaireProps> = ({ questions, onAnswerChange, onSubmit, isLoading }) => (
    <div className="w-full max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-slate-100">Refinemos tu idea.</h2>
        <p className="text-center text-slate-300 mb-8">Responder estas preguntas ayudará a crear un prompt más detallado y preciso.</p>
        <div className="space-y-6">
            {questions.map((q) => (
                <div key={q.id} className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <label className="block text-lg font-semibold text-slate-200 mb-2">{q.question}</label>
                    <input
                        type="text"
                        onChange={(e) => onAnswerChange(q.id, e.target.value)}
                        placeholder="Tu respuesta aquí..."
                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            ))}
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
    finalPrompt: string;
    onRefine: (refinementIdea: string) => void;
    isRefining: boolean;
}

const GenerationResult: React.FC<GenerationResultProps> = ({ resultData, generationType, onStartOver, finalPrompt, onRefine, isRefining }) => {
    const [refinementIdea, setRefinementIdea] = useState('');

    const handleRefineClick = () => {
        if (refinementIdea.trim()) {
            onRefine(refinementIdea);
            setRefinementIdea('');
        }
    };
    
    return (
        <div className="w-full max-w-4xl mx-auto text-center">
             <h2 className="text-3xl font-bold text-slate-100 mb-6">¡Tu Creación está Aquí!</h2>
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-8 flex justify-center items-center relative">
                {isRefining && <div className="absolute inset-0 bg-slate-900/80 flex flex-col justify-center items-center z-10 rounded-lg"><LoadingSpinner /><p className="mt-2 text-slate-200">Generando variante...</p></div>}
                {resultData && generationType === 'IMAGE' && (
                    <img src={resultData} alt="Contenido generado" className="max-w-full max-h-[70vh] rounded-md" />
                )}
                {resultData && generationType === 'VIDEO' && (
                    <video controls src={resultData} className="max-w-full max-h-[70vh] rounded-md" />
                )}
            </div>
            
            {generationType === 'IMAGE' && (
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 text-left">
                    <h3 className="text-2xl font-bold text-slate-100 mb-4">¿Quieres mejorar algo?</h3>
                    <p className="text-slate-300 mb-4">Describe qué te gustaría cambiar o agregar para generar una nueva versión.</p>
                    <textarea
                        value={refinementIdea}
                        onChange={(e) => setRefinementIdea(e.target.value)}
                        placeholder="Ej: ahora con un estilo de acuarela, añade una luna en el cielo, cambia el color del objeto principal a rojo..."
                        className="w-full h-24 p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:ring-2 focus:ring-blue-500"
                        disabled={isRefining}
                    />
                    <button
                        onClick={handleRefineClick}
                        disabled={isRefining || !refinementIdea.trim()}
                        className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                    >
                        {isRefining ? <LoadingSpinner /> : 'Generar Variante'}
                    </button>
                </div>
            )}

            <button
                onClick={onStartOver}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105"
            >
                Crear Algo Nuevo
            </button>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [step, setStep] = useState<AppStep>('IDEA');
    const [initialIdea, setInitialIdea] = useState<string>('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [finalPrompt, setFinalPrompt] = useState<string>('');
    const [generationType, setGenerationType] = useState<GenerationType>('IMAGE');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefining, setIsRefining] = useState<boolean>(false);
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
        if (!initialIdea.trim() && !referenceImage) {
            setError('Por favor, ingresa una idea o sube una imagen para comenzar.');
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Generando preguntas para aclarar...');
        setError(null);
        setStep('QUESTIONS');

        try {
            const generatedQuestions = await generateQuestions(initialIdea, referenceImage);
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
            const synthesizedPrompt = await synthesizePrompt(initialIdea, answers, referenceImage);
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

    const handleRefineSubmit = async (refinementIdea: string) => {
        setIsRefining(true);
        setError(null);
        try {
            // 1. Refine the prompt
            const newPrompt = await refinePrompt(finalPrompt, refinementIdea);
            setFinalPrompt(newPrompt); // Update the prompt for future refinements

            // 2. Generate new image with the new prompt
            const imageUrl = await generateImage(newPrompt, aspectRatio);
            setResultData(imageUrl);

        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || 'Ocurrió un error inesperado durante el refinamiento.';
            setError(`El refinamiento de la imagen falló. ${errorMessage}`);
            // Don't change step, stay on result page
        } finally {
            setIsRefining(false);
        }
    };


    const handleAnswerChange = (id: string, value: string) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handleStartOver = () => {
        setStep('IDEA');
        setInitialIdea('');
        setReferenceImage(null);
        setQuestions([]);
        setAnswers({});
        setFinalPrompt('');
        setError(null);
        setResultData(null);
        setGenerationType('IMAGE');
        setAspectRatio('1:1');
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
                    referenceImage={referenceImage}
                    onImageUpload={setReferenceImage}
                    onImageRemove={() => setReferenceImage(null)}
                />;
            case 'QUESTIONS': 
                return <Questionnaire 
                    questions={questions}
                    onAnswerChange={handleAnswerChange}
                    onSubmit={handleAnswersSubmit}
                    isLoading={isLoading}
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
                    finalPrompt={finalPrompt}
                    onRefine={handleRefineSubmit}
                    isRefining={isRefining}
                />;
            default: 
                return <IdeaInput 
                    initialIdea={initialIdea} 
                    onIdeaChange={setInitialIdea} 
                    onSubmit={handleIdeaSubmit} 
                    isLoading={isLoading}
                    referenceImage={referenceImage}
                    onImageUpload={setReferenceImage}
                    onImageRemove={() => setReferenceImage(null)}
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
