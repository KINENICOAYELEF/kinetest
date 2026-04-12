import React, { useState } from 'react';
import { ClassificationActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: ClassificationActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const ClassificationRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const handleSelect = (cat: string) => {
    if (showFeedback) return;
    setSelectedCat(cat);
    const result = gradeActivity(activity, cat);
    onAnswer(result);
  };

  return (
    <div className="flex-col" style={{ gap: 16, marginTop: 20 }}>
      {activity.scenario && (
        <div style={{ padding: 15, background: 'rgba(255,255,255,0.05)', borderRadius: 10, fontStyle: 'italic', fontSize: '0.95rem' }}>
          {activity.scenario}
        </div>
      )}
      
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Clasifica según:</p>
      
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {activity.categories.map((cat: string) => {
          const isSelected = selectedCat === cat;
          const isCorrect = cat === activity.correct_category;
          
          let borderColor = 'var(--glass-border)';
          let bg = 'rgba(255,255,255,0.05)';
          let color = 'white';

          if (showFeedback) {
            if (isCorrect) { 
              borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.2)'; 
            } else if (isSelected) { 
              borderColor = '#f44336'; bg = 'rgba(244, 67, 54, 0.2)'; 
            }
          } else if (isSelected) {
            borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.2)';
          }

          return (
            <button
              key={cat}
              onClick={() => handleSelect(cat)}
              disabled={showFeedback}
              style={{
                flex: '1 1 calc(33% - 10px)',
                minWidth: '120px',
                padding: '12px 10px',
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                background: bg,
                color,
                fontWeight: 'bold',
                cursor: showFeedback ? 'default' : 'pointer'
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
};
