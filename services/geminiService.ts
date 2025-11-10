
// FIX: Removed import of deprecated 'GenerateContentRequest' as it is no longer exported from "@google/genai".
import { GoogleGenAI, Type, Part } from "@google/genai";
import type { Question, AspectRatio } from '../types';

async function getGenAIClient() {
    // This function ensures a fresh client is created for each call,
    // especially important for Veo to pick up the latest API key.
    if (!process.env.API_KEY) {
        // In a real app, you might want to throw an error or handle this case more gracefully.
        // For Veo, the key is selected via a dialog, so this check is a fallback.
        console.error("API_KEY environment variable not set.");
        // A user-facing error will be thrown from the calling function if the API call fails.
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Helper to extract base64 data and mime type from a data URL
const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } => {
    const parts = dataUrl.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const data = parts[1];
    return { mimeType, data };
};


export async function generateQuestions(idea: string, referenceImages: string[]): Promise<Question[]> {
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
        // Add images before text for better context
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

    try {
        const jsonText = response.text.trim();
        const questionsArray = JSON.parse(jsonText);
        // Basic validation
        if (Array.isArray(questionsArray) && questionsArray.every(q => q.id && q.question && Array.isArray(q.options))) {
            return questionsArray;
        } else {
            throw new Error("Estructura JSON inválida para las preguntas.");
        }
    } catch (e) {
        console.error("Failed to parse questions JSON:", e);
        // Fallback or re-throw
        throw new Error("No se pudo entender la respuesta de la IA para las preguntas.");
    }
}


export async function synthesizePrompt(idea: string, questions: Question[], answers: Record<string, string[]>, referenceImages: string[], additionalIdea: string): Promise<string> {
    const ai = await getGenAIClient();
    const answersString = questions
        .map(q => {
            const answerList = answers[q.id];
            if (answerList && answerList.length > 0) {
                return `Pregunta: ${q.question}\nRespuesta seleccionada: ${answerList.join(', ')}`;
            }
            return null;
        })
        .filter(item => item !== null) // Remove questions that were not answered
        .join('\n\n');

    let additionalIdeaText = '';
    if (additionalIdea.trim()) {
        additionalIdeaText = `\n\nDetalles Adicionales del Usuario:
${additionalIdea}`;
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
        // Add images before text
        parts.unshift(...imageParts);
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: { parts },
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });

    return response.text.trim();
}

export async function refinePrompt(originalPrompt: string, refinementIdea: string, keepFaces: boolean): Promise<string> {
    const ai = await getGenAIClient();

    let finalRefinementIdea = refinementIdea;
    if (keepFaces) {
        finalRefinementIdea += "\n\n**Instrucción Adicional Importante:** No alteres, cambies o regeneres los rostros de ninguna persona presente en la imagen. Mantén sus características faciales idénticas a como se describen en el prompt original.";
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `Eres un ingeniero de prompts de clase mundial. Tu tarea es refinar un prompt existente basado en una nueva indicación del usuario.

Prompt Original: "${originalPrompt}"

Indicación de Refinamiento del Usuario: "${finalRefinementIdea}"

Integra la indicación de refinamiento en el prompt original para crear una nueva versión mejorada. El nuevo prompt debe mantener la esencia del original pero incorporar el cambio solicitado de manera fluida y detallada. No hagas preguntas. Solo proporciona el texto del nuevo prompt final en un único párrafo.`,
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    return response.text.trim();
}


export async function generateImage(prompt: string, aspectRatio: string): Promise<string> {
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

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    }
    throw new Error("La generación de imagen no pudo producir una imagen.");
}

export async function generateVideo(prompt: string, aspectRatio: string): Promise<string> {
    const ai = await getGenAIClient();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio as '16:9' | '9:16',
        },
    });

    // Poll for completion
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("La generación de video se completó, pero no se encontró un enlace de descarga.");
    }

    // The download link needs the API key appended to it
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!videoResponse.ok) {
        throw new Error(`Error al descargar el video generado. Estado: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);
}
