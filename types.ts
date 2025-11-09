
import { IMAGE_ASPECT_RATIOS, VIDEO_ASPECT_RATIOS } from './constants';

export interface Question {
  id: string;
  question: string;
}

export type AppStep = 'IDEA' | 'QUESTIONS' | 'PROMPT' | 'GENERATING' | 'RESULT';

export type GenerationType = 'IMAGE' | 'VIDEO';

export type AspectRatio = typeof IMAGE_ASPECT_RATIOS[number] | typeof VIDEO_ASPECT_RATIOS[number];
