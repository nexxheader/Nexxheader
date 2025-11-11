// FIX: Removed import of deprecated 'GenerateContentRequest' as it is no longer exported from "@google/genai".
import { GoogleGenAI, Type, Part, GenerateContentResponse } from "@google/genai";
import type { Question, AspectRatio } from '../types';

async function getGenAIClient() {
    // This function creates a new GenAI client instance.
    if (!process.env.API_KEY) {
        // The API key is expected to be set in the environment.
        // A user-facing error will be thrown from the calling function if an API call fails due to a missing key.
        console.error("API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Helper for retrying operations with exponential backoff
const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries = 3
): Promise<T> => {
    let lastError: any = new Error("La operación falló después de múltiples reintentos.");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation(); // Attempt the entire operation
        } catch (error) {
            lastError = error;
            console.error(`Intento de operación ${attempt + 1} fallido:`, error);
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
                console.log(`Reintentando en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
};

// Helper to extract base64 data and mime type from a data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    const parts = dataUrl.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const data = parts[1];
    return { mimeType, data };
};


export async function generateQuestions(idea: string, referenceImages: string[]): Promise<Question[]> {
     return retryOperation(async () => {
        const ai = await getGenAIClient();
        const textPart: Part = { text: `Basado en la idea simple del usuario "${idea}" y las imágenes de referencia adjuntas (si las hay), genera un máximo de 3 preguntas para construir un prompt detallado para un generador de IA. Para cada pregunta, proporciona también un array de 4 a 6 opciones de respuesta concisas y variadas que el usuario pueda seleccionar.

La estructura de las preguntas debe ser:
1.  Una pregunta sobre la escena general, la atmósfera, la iluminación y la paleta de colores.
2.  Una pregunta sobre los detalles del sujeto o personaje principal (apariencia, acciones, emociones).
3.  Una pregunta sobre el estilo artístico, la composición de la cámara o cualquier otro detalle crucial para mejorar el resultado.

Devuelve las preguntas como un array JSON de objetos, donde cada objeto tiene un "id", una "question" y un array "options" con las sugerencias de respuesta.` };
    
        const parts: Part[] = [textPart];

        if (referenceImages.length > 0) {
            const imageParts: Part[] = referenceImages.map(image => {
                const { mimeType, data } = parseDataUrl(image);
                return { inlineData: { mimeType, data } };
            });
            parts.unshift(...imageParts);
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            question: { type: Type.STRING },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ["id", "question", "options"],
                    },
                },
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });

        const jsonText = response.text.trim();
        if (!jsonText) {
            throw new Error("La respuesta de la IA estaba vacía.");
        }

        try {
            const questionsArray = JSON.parse(jsonText);
            if (Array.isArray(questionsArray) && questionsArray.every(q => q.id && q.question && Array.isArray(q.options))) {
                return questionsArray;
            } else {
                throw new Error("Estructura JSON inválida para las preguntas.");
            }
        } catch (e) {
            console.error("Fallo al parsear el JSON de las preguntas:", jsonText, e);
            throw new Error("No se pudo entender la respuesta de la IA para las preguntas.");
        }
    });
}


export async function synthesizePrompt(idea: string, questions: Question[], answers: Record<string, string[]>, referenceImages: string[], additionalIdea: string): Promise<string> {
    return retryOperation(async () => {
        const ai = await getGenAIClient();
        const answersString = questions
            .map(q => {
                const answerList = answers[q.id];
                if (answerList && answerList.length > 0) {
                    return `Pregunta: ${q.question}\nRespuesta seleccionada: ${answerList.join(', ')}`;
                }
                return null;
            })
            .filter(item => item !== null)
            .join('\n\n');

        let additionalIdeaText = '';
        if (additionalIdea.trim()) {
            additionalIdeaText = `\n\nDetalles Adicionales del Usuario:\n${additionalIdea}`;
        }

        const promptText = `Eres un ingeniero de prompts de clase mundial para generadores de imágenes y videos con IA. Tu tarea es sintetizar la idea inicial del usuario, sus respuestas a las preguntas de refinamiento, sus detalles adicionales y el contenido de las imágenes de referencia (si se proporcionan) en un único prompt profesional, cohesivo y muy detallado.

Idea Inicial: "${idea}"

Preguntas y Respuestas de Refinamiento:
${answersString}${additionalIdeaText}

Si hay imágenes de referencia, describe sus elementos clave, estilo y composición e incorpóralos al prompt. Combina toda esta información en un solo párrafo. El prompt debe ser descriptivo, evocador y proporcionar instrucciones claras para la IA. No hagas más preguntas. Solo proporciona el texto del prompt final.`;

        const textPart: Part = { text: promptText };
        const parts: Part[] = [textPart];

        if (referenceImages.length > 0) {
            const imageParts: Part[] = referenceImages.map(image => {
                const { mimeType, data } = parseDataUrl(image);
                return { inlineData: { mimeType, data } };
            });
            parts.unshift(...imageParts);
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts },
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });

        const text = response.text.trim();
        if (!text) {
            throw new Error("La respuesta de la IA para sintetizar el prompt estaba vacía.");
        }
        return text;
    });
}

export async function generateImage(prompt: string, aspectRatio: string): Promise<string> {
    return retryOperation(async () => {
        const ai = await getGenAIClient();
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                outputMimeType: 'image/png',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        throw new Error("La generación de imagen no pudo producir una imagen.");
    });
}