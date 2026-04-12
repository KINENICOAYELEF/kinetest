import React, { useState } from 'react';
import { TrueFalseActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: TrueFalseActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const TrueFalseRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [isTrue, setIsTrue] = useState<boolean | null>(null);
  const [justificationIndex, setJustificationIndex] = useState<number | null>(null);

  const handleVfSelect = (val: boolean) => {
    if (showFeedback) return;
    setIsTrue(val);
    if (justificationIndex !== null) {
      onAnswer(gradeActivity(activity, { isTrue: val, justificationIndex }));
    }
  };

  const handleJustificationSelect = (index: number) => {
    if (showFeedback) return;
    setJustificationIndex(index);
    if (isTrue !== null) {
      onAnswer(gradeActivity(activity, { isTrue, justificationIndex: index }));
    }
  };

  return (
    <div className="flex-col" style={{ gap: 24, marginTop: 20 }}>
      {activity.statement && (
        <div style={{ padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, borderLeft: '4px solid var(--primary)', fontSize: '1.1rem', fontStyle: 'italic' }}>
          "{activity.statement}"
        </div>
      )}

      <div>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>1. ¿La afirmación es verdadera o falsa?</p>
        <div style={{ display: 'flex', gap: 15 }}>
          {[true, false].map(val => {
            const isSelected = isTrue === val;
            const isCorrect = val === activity.correct_answer;
            let bg = isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)';
            let bColor = isSelected ? 'var(--primary)' : 'var(--glass-border)';

            if (showFeedback) {
              if (isCorrect) { bg = 'rgba(16, 185, 129, 0.2)'; bColor = 'var(--accent)'; }
              else if (isSelected) { bg = 'rgba(244, 67, 54, 0.2)'; bColor = '#f44336'; }
            }

            return (
              <button key={val.toString()} disabled={showFeedback} onClick={() => handleVfSelect(val)} style={{
                flex: 1, padding: 15, background: bg, border: `2px solid ${bColor}`, borderRadius: 10, color: 'white', fontWeight: 'bold'
              }}>
                {val ? 'VERDADERO' : 'FALSO'}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ opacity: isTrue === null ? 0.3 : 1, transition: 'opacity 0.3s' }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>2. Selecciona la justificación correcta:</p>
        <div className="flex-col" style={{ gap: 10 }}>
          {activity.justification_options.map((opt: any, i: number) => {
            const isSelected = justificationIndex === i;
            const isCorrect = opt.isCorrect;
            let bg = isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)';
            let bColor = isSelected ? 'var(--primary)' : 'var(--glass-border)';

            if (showFeedback && isTrue !== null) {
              if (isCorrect) { bg = 'rgba(16, 185, 129, 0.1)'; bColor = 'var(--accent)'; }
              else if (isSelected) { bg = 'rgba(244, 67, 54, 0.1)'; bColor = '#f44336'; }
            }

            return (
              <button key={i} disabled={showFeedback || isTrue === null} onClick={() => handleJustificationSelect(i)} style={{
                padding: 15, background: bg, border: `1px solid ${bColor}`, borderRadius: 10, color: 'white', textAlign: 'left', fontSize: '0.9rem'
              }}>
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
