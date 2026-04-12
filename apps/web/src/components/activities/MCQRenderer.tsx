import React, { useState } from 'react';
import { MCQActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: MCQActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const MCQRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    if (showFeedback) return;
    setSelectedOpt(index);
    const result = gradeActivity(activity, index);
    onAnswer(result);
  };

  return (
    <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
      {activity.options.map((opt: any, index: number) => {
        const isSelected = selectedOpt !== null && selectedOpt === index;
        const isCorrect = opt.isCorrect;
        
        let borderColor = 'var(--glass-border)';
        let bg = 'rgba(255,255,255,0.02)';
        let color = 'var(--text-muted)';

        if (showFeedback) {
            if (isCorrect) { borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'white'; }
            else if (isSelected) { borderColor = '#f44336'; bg = 'rgba(244, 67, 54, 0.1)'; color = 'white'; }
        } else if (isSelected) {
            borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; color = 'white';
        }

        return (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={showFeedback}
            style={{ 
                padding: 16, textAlign: 'left', border: '1px solid', borderColor, borderRadius: 12, background: bg, color, 
                cursor: showFeedback ? 'default' : 'pointer', 
                fontSize: '0.95rem'
            }}
          >
            {opt.text}
          </button>
        );
      })}
    </div>
  );
};
