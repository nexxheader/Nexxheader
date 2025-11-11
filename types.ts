
import { IMAGE_ASPECT_RATIOS } from './constants';

export interface Question {
  id: string;
  question: string;
  options: string[];
}

export type AppStep = 'IDEA' | 'QUESTIONS' | 'PROMPT' | 'GENERATING' | 'RESULT';

export type AspectRatio = typeof IMAGE_ASPECT_RATIOS[number];