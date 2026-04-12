import React from 'react';
import { Activity } from '../../types/questions';
import { ActivityResult } from '../../utils/activityGrader';

import { MCQRenderer } from './MCQRenderer';
import { MultiSelectRenderer } from './MultiSelectRenderer';
import { ClassificationRenderer } from './ClassificationRenderer';
import { OrderingRenderer } from './OrderingRenderer';
import { DosificationRenderer } from './DosificationRenderer';
import { MatchingRenderer } from './MatchingRenderer';
import { TrueFalseRenderer } from './TrueFalseRenderer';

interface Props {
  activity: Activity;
  onAnswer: (result: ActivityResult) => void;
  showFeedback: boolean;
  disabled?: boolean;
}

export const ActivityRenderer: React.FC<Props> = ({ activity, onAnswer, showFeedback, disabled }) => {
  // Pass through showFeedback (which disables interaction)
  const isReadOnly = showFeedback || disabled;

  switch (activity.activity_type) {
    case 'mcq':
    case undefined: // Fallback for legacy format
      return <MCQRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
    
    case 'multi_select':
      return <MultiSelectRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    case 'classification':
      return <ClassificationRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    case 'ordering':
      return <OrderingRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    case 'dosification':
      return <DosificationRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    case 'matching':
      return <MatchingRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    case 'true_false':
      return <TrueFalseRenderer activity={activity as any} showFeedback={isReadOnly!} onAnswer={onAnswer} />;
      
    default:
      return <div><p style={{ color: 'red' }}>Error: Tipo de actividad desconocido ({String((activity as any).activity_type)})</p></div>;
  }
};
