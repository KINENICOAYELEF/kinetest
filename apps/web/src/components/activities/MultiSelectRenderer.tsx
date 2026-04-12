import React, { useState } from 'react';
import { MultiSelectActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: MultiSelectActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const MultiSelectRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [selectedOpts, setSelectedOpts] = useState<number[]>([]);

  const toggleSelect = (index: number) => {
    if (showFeedback) return;
    setSelectedOpts(prev => {
      const newSelections = prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index];
      // Note: we don't call onAnswer immediately here since it's a multi-select.
      // We might need a "Submit" button wrapper in the parent, or we emit the partial result.
      const result = gradeActivity(activity, newSelections);
      onAnswer(result);
      return newSelections;
    });
  };

  return (
    <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>* Selecciona todas las correctas</p>
      {activity.options.map((opt: any, index: number) => {
        const isSelected = selectedOpts.includes(index);
        const isCorrect = opt.isCorrect;
        
        let borderColor = 'var(--glass-border)';
        let bg = 'rgba(255,255,255,0.02)';
        let color = 'var(--text-muted)';

        if (showFeedback) {
            if (isCorrect) { 
                borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'white'; 
            } else if (isSelected) { 
                borderColor = '#f44336'; bg = 'rgba(244, 67, 54, 0.1)'; color = 'white'; 
            }
        } else if (isSelected) {
            borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; color = 'white';
        }

        return (
          <button
            key={index}
            onClick={() => toggleSelect(index)}
            disabled={showFeedback}
            style={{ 
                padding: 16, textAlign: 'left', border: '1px solid', borderColor, borderRadius: 12, background: bg, color, 
                cursor: showFeedback ? 'default' : 'pointer', 
                fontSize: '0.95rem',
                display: 'flex', gap: 10, alignItems: 'center'
            }}
          >
            <div style={{
                width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}`,
                background: isSelected ? 'var(--primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {isSelected && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
            </div>
            {opt.text}
          </button>
        );
      })}
    </div>
  );
};
