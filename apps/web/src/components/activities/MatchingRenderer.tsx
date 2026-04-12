import React, { useState, useEffect } from 'react';
import { MatchingActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';
import { shuffleArray } from '../../utils/shuffle';

interface Props {
  activity: MatchingActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const MatchingRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  const [leftItems, setLeftItems] = useState<{ id: number, text: string }[]>([]);
  const [rightItems, setRightItems] = useState<{ id: number, text: string }[]>([]);
  
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<{ leftId: number, rightId: number }[]>([]);

  useEffect(() => {
    // Initialize shuffled lists with IDs
    const pairs = activity.pairs.map((p: any, i: number) => ({ id: i, left: p.left, right: p.right }));
    setLeftItems(shuffleArray(pairs.map((p: any) => ({ id: p.id, text: p.left }))));
    setRightItems(shuffleArray(pairs.map((p: any) => ({ id: p.id, text: p.right }))));
  }, [activity]);

  const handleLeftClick = (id: number) => {
    if (showFeedback) return;
    setSelectedLeft(selectedLeft === id ? null : id); // toggle
  };

  const handleRightClick = (rightId: number) => {
    if (showFeedback) return;
    if (selectedLeft === null) return; // Must select left first

    setMatches(prev => {
      // Remove any existing match for this left item or this right item
      const newMatches = prev.filter(m => m.leftId !== selectedLeft && m.rightId !== rightId);
      newMatches.push({ leftId: selectedLeft, rightId });
      
      // If all matched, automatically grade
      if (newMatches.length === activity.pairs.length) {
        const userPairs = newMatches.map(m => {
          const lText = leftItems.find(l => l.id === m.leftId)!.text;
          const rText = rightItems.find(r => r.id === m.rightId)!.text;
          return { left: lText, right: rText };
        });
        onAnswer(gradeActivity(activity, userPairs));
      }
      
      return newMatches;
    });
    setSelectedLeft(null);
  };

  const getMatchColors = (leftId: number, rightId: number) => {
    if (!showFeedback) return { border: 'var(--primary)', bg: 'rgba(99, 102, 241, 0.1)' };
    
    // In feedback mode, check if this specific match is correct
    const lItem = leftItems.find(l => l.id === leftId)!.text;
    const rItem = rightItems.find(r => r.id === rightId)!.text;
    const isCorrect = activity.pairs.some((p: any) => p.left === lItem && p.right === rItem);
    
    if (isCorrect) return { border: 'var(--accent)', bg: 'rgba(16, 185, 129, 0.1)' };
    return { border: '#f44336', bg: 'rgba(244, 67, 54, 0.1)' };
  };

  return (
    <div className="flex-col" style={{ gap: 20, marginTop: 20 }}>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {!showFeedback ? '* Selecciona un elemento de la izquierda y conéctalo con uno de la derecha' : 'Resultados:'}
      </p>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leftItems.map(item => {
            const isSelected = selectedLeft === item.id;
            const match = matches.find(m => m.leftId === item.id);
            
            let style = { border: '1px solid var(--glass-border)', bg: 'rgba(255,255,255,0.02)', opacity: 1 };
            if (isSelected) style = { border: '1px solid var(--primary)', bg: 'rgba(99, 102, 241, 0.2)', opacity: 1 };
            else if (match) {
              const colors = getMatchColors(match.leftId, match.rightId);
              style = { border: `1px solid ${colors.border}`, bg: colors.bg, opacity: 1 };
            }

            return (
              <button key={`l-${item.id}`} disabled={showFeedback} onClick={() => handleLeftClick(item.id)} style={{
                padding: 15, background: style.bg, border: style.border, borderRadius: 10, color: 'white', textAlign: 'center', fontSize: '0.9rem',
                opacity: style.opacity
              }}>
                {item.text}
              </button>
            );
          })}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rightItems.map(item => {
            const match = matches.find(m => m.rightId === item.id);
            
            let style = { border: '1px solid var(--glass-border)', bg: 'rgba(255,255,255,0.02)', cursor: selectedLeft !== null ? 'pointer' : 'default' };
            if (match) {
              const colors = getMatchColors(match.leftId, match.rightId);
              style = { border: `1px solid ${colors.border}`, bg: colors.bg, cursor: 'default' };
            }

            return (
              <button key={`r-${item.id}`} disabled={showFeedback} onClick={() => handleRightClick(item.id)} style={{
                padding: 15, background: style.bg, border: style.border, borderRadius: 10, color: 'white', textAlign: 'center', fontSize: '0.9rem', cursor: showFeedback ? 'default' : style.cursor
              }}>
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
