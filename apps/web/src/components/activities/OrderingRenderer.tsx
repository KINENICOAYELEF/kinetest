import React, { useState, useEffect } from 'react';
import { OrderingActivity } from '../../types/questions';
import { ActivityResult, gradeActivity } from '../../utils/activityGrader';

interface Props {
  activity: OrderingActivity;
  showFeedback: boolean;
  onAnswer: (result: ActivityResult) => void;
}

export const OrderingRenderer: React.FC<Props> = ({ activity, showFeedback, onAnswer }) => {
  // Initialize with sequential indices [0, 1, 2, ...]
  const [currentOrder, setCurrentOrder] = useState<number[]>([]);
  
  useEffect(() => {
    setCurrentOrder(activity.items.map((_: any, i: number) => i));
  }, [activity]);

  const moveItem = (index: number, direction: -1 | 1) => {
    if (showFeedback) return;
    
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    
    const newOrder = [...currentOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[newIndex];
    newOrder[newIndex] = temp;
    
    setCurrentOrder(newOrder);
    onAnswer(gradeActivity(activity, newOrder));
  };

  return (
    <div className="flex-col" style={{ gap: 10, marginTop: 20 }}>
      {currentOrder.map((originalIndex, currentIndex) => {
        const item = activity.items[originalIndex];
        
        // Visual feedback
        let borderColor = 'var(--glass-border)';
        if (showFeedback) {
            const isCorrectPosition = activity.correct_order[currentIndex] === originalIndex;
            borderColor = isCorrectPosition ? 'var(--accent)' : '#f44336';
        }

        return (
          <div key={item} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${borderColor}`, borderRadius: 10
          }}>
            <div className="flex-col" style={{ gap: 4 }}>
                <button 
                  disabled={showFeedback || currentIndex === 0} 
                  onClick={() => moveItem(currentIndex, -1)}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: (showFeedback || currentIndex === 0) ? 'default' : 'pointer' }}
                >
                  🔼
                </button>
                <button 
                  disabled={showFeedback || currentIndex === currentOrder.length - 1} 
                  onClick={() => moveItem(currentIndex, 1)}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: (showFeedback || currentIndex === currentOrder.length - 1) ? 'default' : 'pointer' }}
                >
                  🔽
                </button>
            </div>
            <div style={{ flex: 1, fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginRight: 10 }}>{currentIndex + 1}.</span>
                {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};
