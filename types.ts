export enum AppMode {
  HOME = 'HOME',
  LOGIN = 'LOGIN',
  REVIEW = 'REVIEW',
  ONBOARDING = 'ONBOARDING',
  HEAR_IMAGES = 'HEAR_IMAGES',
  SEE_SOUND = 'SEE_SOUND',
  EASY_READ = 'EASY_READ',
  CLASS_PACK = 'CLASS_PACK',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  SETTINGS = 'SETTINGS',
  CAMERA = 'CAMERA'
}

export enum UserDisability {
  NONE = 'NONE',
  VISUAL = 'VISUAL',
  HEARING = 'HEARING',
  DYSLEXIA = 'DYSLEXIA'
}

export interface UserPreferences {
  name: string;
  grade: string;
  language: string;
  location: string;
  disability: UserDisability;
  culturalContext: boolean;
}

/**
 * What may be sent to the server for generation: the profile minus the learner's name.
 * The name never leaves the device (spec C4), so it is absent from the type rather than
 * merely omitted at the call site — that way a future caller cannot reintroduce it by
 * accident and still typecheck.
 */
export type GenerationPrefs = Omit<UserPreferences, 'name'>;

export enum Role {
  TEACHER = 'TEACHER',
  LEARNER = 'LEARNER',
}

/** An account on this device. `hash` and `salt` are PBKDF2 material, never a password. */
export interface Account {
  id: string;
  username: string;
  role: Role;
  salt: string;
  hash: string;
  createdAt: string;
}

export type ReviewStatus = 'pending' | 'released' | 'discarded';
export type ReviewDecision = 'released' | 'discarded';

/** One piece of AI output waiting for, or having had, a teacher's decision. */
export interface ReviewItem {
  id: string;
  mode: AppMode;
  learnerAccountId: string;
  /** What the model produced. Replaced by the teacher's text if they edit before release. */
  content: EducationalContent;
  /** The model's untouched output, kept so the log can say whether the teacher edited. */
  originalContent: EducationalContent;
  status: ReviewStatus;
  generatedAt: string;
  decidedAt?: string;
  cacheHit: boolean;
  /** True once the source media has been deleted (spec C3). */
  mediaDeleted: boolean;
}

/** One row of the review log. Carries no learner name (spec C4). */
export interface ReviewLogRow {
  itemId: string;
  mode: AppMode;
  generatedAt: string;
  decidedAt: string;
  decision: ReviewDecision;
  edited: boolean;
  reviewSeconds: number;
  cacheHit: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface EducationalContent {
  // Common
  mode: AppMode;
  topic: string;
  
  // Mode 1: Hear Images
  spatialDescription?: string;
  tactileModelSuggestion?: string;
  
  // Mode 2: See Sound
  transcript?: string; // With visual cues
  summary?: string;
  emotionalTone?: string;
  keyTerms?: string[];
  
  // Mode 3: Easy Read
  simplifiedText?: string; // Chunked/Bullet points
  analogies?: string;
  quiz?: QuizQuestion[];
  
  // Mode 4: Class Pack
  studentNotes?: string;
  parentSummary?: string; // For WhatsApp
  
  // Legacy/General
  followUpSuggestions: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ToolConfig {
  voiceName?: string;
}