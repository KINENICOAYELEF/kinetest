import React, { useState } from 'react';
import { DosificationActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: DosificationActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const DosificationRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [fields, setFields] = useState<Record<string, number>>({});
  const [contraction, setContraction] = useState<string | null>(null);

  const handleFieldChange = (name: string, valStr: string) => {
    if (showFeedback) return;
    const val = parseFloat(valStr) || 0;
    const newFields = { ...fields, [name]: val };
    setFields(newFields);
    onAnswer(gradeActivity(activity, newFields, contraction || undefined));
  };

  const handleContractionSelect = (c: string) => {
    if (showFeedback) return;
    setContraction(c);
    onAnswer(gradeActivity(activity, fields, c));
  };

  return (
    <div className="flex-col" style={{ gap: 20, marginTop: 20 }}>
      {activity.scenario && (
        <div style={{ padding: 15, background: 'rgba(255,255,255,0.05)', borderRadius: 10, fontSize: '0.95rem' }}>
          {activity.scenario}
        </div>
      )}
      
      {activity.objective && (
        <h4 style={{ margin: 0, color: 'var(--accent)' }}>Objetivo: {activity.objective}</h4>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15 }}>
        {activity.fields.map((field: any) => {
          let fieldColor = 'var(--text-main)';
          let feedbackSpan = null;
          
          if (showFeedback) {
            const val = fields[field.name];
            const isCorrect = val >= field.correct_range[0] && val <= field.correct_range[1];
            fieldColor = isCorrect ? 'var(--accent)' : '#f44336';
            if (!isCorrect) {
              feedbackSpan = <div style={{ fontSize: '0.75rem', color: '#fba9a9', marginTop: 4 }}>Rango correcto: {field.correct_range[0]} - {field.correct_range[1]}</div>;
            }
          }

          return (
            <div key={field.name} style={{ background: 'rgba(255,255,255,0.02)', padding: 15, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{field.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="number"
                  disabled={showFeedback}
                  value={fields[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  style={{
                    width: '100%', padding: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid', borderColor: showFeedback ? fieldColor : 'var(--glass-border)',
                    borderRadius: 8, color: 'white', textAlign: 'center'
                  }}
                />
                {field.unit && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{field.unit}</span>}
              </div>
              {feedbackSpan}
            </div>
          );
        })}
      </div>

      {activity.contraction_type && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tipo de Contracción:</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {activity.contraction_type.options.map((c: string) => {
               const isSelected = contraction === c;
               const isCorrect = c === activity.contraction_type?.correct;
               
               let bg = isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)';
               let bColor = isSelected ? 'var(--primary)' : 'var(--glass-border)';

               if (showFeedback) {
                 if (isCorrect) { bg = 'rgba(16, 185, 129, 0.2)'; bColor = 'var(--accent)'; }
                 else if (isSelected) { bg = 'rgba(244, 67, 54, 0.2)'; bColor = '#f44336'; }
               }

               return (
                 <button key={c} disabled={showFeedback} onClick={() => handleContractionSelect(c)} style={{
                   flex: 1, padding: 10, background: bg, border: `1px solid ${bColor}`, borderRadius: 8, color: 'white'
                 }}>
                   {c}
                 </button>
               );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
