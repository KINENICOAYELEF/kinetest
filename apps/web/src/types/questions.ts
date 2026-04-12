// schemas para tipos de preguntas - Tutor V2

// Base fields shared by ALL activity types
export interface BaseActivity {
  question_id: string; // Document ID in Firestore
  activity_type?: 'mcq' | 'multi_select' | 'classification' | 'ordering' | 'dosification' | 'matching' | 'true_false';
  content: string;           // The question/scenario text
  rationale: string;         // Explanation
  learning_pearl?: string;   // Key takeaway
  hints?: string[];          // Hints
  difficulty: number;        // 1-5
  tags: string[];
  family_id?: string;
  unit_id?: string;
  question_type?: string;    // knowledge|comprehension|evaluation|interview|domain classification
  status?: 'draft' | 'approved' | 'rejected' | string;
  time_seconds?: number;     // 90 or 120
  domain?: string;           // A1-F4 competency code
}

// 1. MCQ — Classic 4-option (existing format fallback)
export interface MCQActivity extends BaseActivity {
  activity_type?: 'mcq'; 
  options: { text: string; isCorrect: boolean }[];
}

// 2. Multi-Select — Mark ALL correct (2+ correct options)
export interface MultiSelectActivity extends BaseActivity {
  activity_type: 'multi_select';
  options: { text: string; isCorrect: boolean }[];
}

// 3. Classification — Categorize into a group
export interface ClassificationActivity extends BaseActivity {
  activity_type: 'classification';
  scenario?: string;           // Clinical scenario to classify (optional if integrated in content)
  categories: string[];       // e.g., ["Alta", "Moderada", "Baja"]
  correct_category: string;   // e.g., "Alta"
}

// 4. Ordering — Put items in correct sequence
export interface OrderingActivity extends BaseActivity {
  activity_type: 'ordering';
  items: string[];             // Items to order (displayed shuffled)
  correct_order: number[];     // Indices of correct order, e.g., [2,0,3,1]
}

// 5. Dosification — Fill numeric fields with valid ranges
export interface DosificationActivity extends BaseActivity {
  activity_type: 'dosification';
  scenario?: string;            // Clinical context (optional)
  objective?: string;           // e.g., "hipertrofia", "analgesia"
  fields: {
    name: string;              // e.g., "series", "repeticiones", "intensidad_pct_1rm"
    label: string;             // e.g., "Series", "Repeticiones", "% 1RM"
    correct_range: [number, number]; // [min, max]
    unit?: string;             // e.g., "series", "%1RM", "RPE"
  }[];
  contraction_type?: {
    options: string[];         // e.g., ["concéntrico", "excéntrico", "isométrico"]
    correct: string;
  };
}

// 6. Matching — Connect column A to column B
export interface MatchingActivity extends BaseActivity {
  activity_type: 'matching';
  pairs: { left: string; right: string }[];
}

// 7. True/False Justified — V/F + select justification
export interface TrueFalseActivity extends BaseActivity {
  activity_type: 'true_false';
  statement?: string;          // The statement to evaluate
  correct_answer: boolean;     // true or false
  justification_options: { text: string; isCorrect: boolean }[];  // Options for justification
}

export type Activity = 
  | MCQActivity 
  | MultiSelectActivity 
  | ClassificationActivity 
  | OrderingActivity 
  | DosificationActivity 
  | MatchingActivity 
  | TrueFalseActivity;
