import { Activity } from '../types/questions';

export interface ActivityResult {
  isCorrect: boolean;
  score: number;      // 0.0 to 1.0 (partial credit)
  details: any;       // Type-specific result data
}

/**
 * Grades the student's answer based on the activity type.
 */
export function gradeActivity(activity: Activity, studentAnswer: any, contractionType?: string): ActivityResult {
  switch (activity.activity_type) {
    case 'mcq':
    case undefined: // Fallback for legacy
      return gradeMCQ(activity, studentAnswer);
    case 'multi_select':
      return gradeMultiSelect(activity, studentAnswer);
    case 'classification':
      return gradeClassification(activity, studentAnswer);
    case 'ordering':
      return gradeOrdering(activity, studentAnswer);
    case 'dosification':
      return gradeDosification(activity, studentAnswer, contractionType);
    case 'matching':
      return gradeMatching(activity, studentAnswer);
    case 'true_false':
      return gradeTrueFalse(activity, studentAnswer);
    default:
      return { isCorrect: false, score: 0, details: { error: 'Unknown activity type' } };
  }
}

function gradeMCQ(activity: any, selectedIndex: number): ActivityResult {
  const isCorrect = activity.options[selectedIndex]?.isCorrect || false;
  return {
    isCorrect,
    score: isCorrect ? 1.0 : 0.0,
    details: { selectedIndex }
  };
}

function gradeMultiSelect(activity: any, selectedIndices: number[]): ActivityResult {
  let correctSelected = 0;
  let incorrectSelected = 0;
  let totalCorrectOptions = 0;

  activity.options.forEach((opt: any, index: number) => {
    if (opt.isCorrect) totalCorrectOptions++;
    if (selectedIndices.includes(index)) {
      if (opt.isCorrect) correctSelected++;
      else incorrectSelected++;
    }
  });

  // Calculate score: correct selections minus penalty for incorrect ones
  let rawScore = (correctSelected / totalCorrectOptions) - (incorrectSelected * 0.5); // Penalty example
  let score = Math.max(0, Math.min(1, rawScore)); 

  return {
    isCorrect: score === 1.0,
    score,
    details: { correctSelected, incorrectSelected, totalCorrectOptions }
  };
}

function gradeClassification(activity: any, selectedCategory: string): ActivityResult {
  const isCorrect = activity.correct_category === selectedCategory;
  return {
    isCorrect,
    score: isCorrect ? 1.0 : 0.0,
    details: { selectedCategory, expected: activity.correct_category }
  };
}

function gradeOrdering(activity: any, userOrder: number[]): ActivityResult {
  // Simple exactly matching sequence for boolean correctness
  let isCorrect = true;
  for (let i = 0; i < userOrder.length; i++) {
    if (userOrder[i] !== activity.correct_order[i]) {
      isCorrect = false;
      break;
    }
  }

  // Partial score logic (simplified: 1/n for each item in correct absolute position)
  // E.g., if array length 4, and 2 items match target index exactly, score = 0.5
  let exactMatches = 0;
  for (let i = 0; i < userOrder.length; i++) {
    if (userOrder[i] === activity.correct_order[i]) exactMatches++;
  }
  const score = exactMatches / activity.correct_order.length;

  return {
    isCorrect,
    score,
    details: { exactMatches, total: activity.correct_order.length }
  };
}

function gradeDosification(activity: any, fieldValues: Record<string, number>, contractionType?: string): ActivityResult {
  let totalFields = activity.fields.length;
  let correctFields = 0;

  activity.fields.forEach((field: any) => {
    const val = fieldValues[field.name];
    if (val !== undefined && val >= field.correct_range[0] && val <= field.correct_range[1]) {
      correctFields++;
    }
  });

  if (activity.contraction_type) {
    totalFields++;
    if (contractionType === activity.contraction_type.correct) {
      correctFields++;
    }
  }

  const score = correctFields / totalFields;

  return {
    isCorrect: score === 1.0,
    score,
    details: { correctFields, totalFields }
  };
}

function gradeMatching(activity: any, userPairs: { left: string, right: string }[]): ActivityResult {
  let correctMatches = 0;
  
  userPairs.forEach(pair => {
    // Check if this pair exists in correct pairs
    const found = activity.pairs.find((p: any) => p.left === pair.left && p.right === pair.right);
    if (found) correctMatches++;
  });

  const score = correctMatches / activity.pairs.length;

  return {
    isCorrect: score === 1.0,
    score,
    details: { correctMatches, total: activity.pairs.length }
  };
}

function gradeTrueFalse(activity: any, userParams: { isTrue: boolean, justificationIndex: number }): ActivityResult {
  const isVfCorrect = userParams.isTrue === activity.correct_answer;
  const isJustificationCorrect = activity.justification_options[userParams.justificationIndex]?.isCorrect;
  
  let score = 0;
  if (isVfCorrect) score += 0.5;
  if (isJustificationCorrect) score += 0.5;

  return {
    isCorrect: score === 1.0,
    score,
    details: { isVfCorrect, isJustificationCorrect }
  };
}
