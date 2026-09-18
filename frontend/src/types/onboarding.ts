import type { Intent } from './auth';

export type InputType =
  | 'text'
  | 'number'
  | 'date'
  | 'single_choice'
  | 'multi_choice'
  | 'boolean'
  | 'scale'
  | 'object'
  | 'list'
  | 'password'
  | 'email'
  | 'photos'
  | 'video';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  field: string;
  prompt: string;
  help_text: string;
  input_type: InputType;
  required: boolean;
  applies_to: Intent[];
  options: QuestionOption[];
  used_for: string[];
  upload_endpoint?: string | null;
  minimum_files?: number | null;
  maximum_files?: number | null;
  accepted_types?: string[];
  max_file_bytes?: number | null;
  max_duration_seconds?: number | null;
}

export interface QuestionSection {
  id: string;
  title: string;
  questions: Question[];
}

export interface Questionnaire {
  version?: string;
  introduction: string;
  sections: QuestionSection[];
  validation_schema?: string;
}
