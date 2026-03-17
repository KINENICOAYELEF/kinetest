/**
 * Adaptive Engine for Kine Poli
 * Uses EWMA (Exponentially Weighted Moving Average) for mastery
 * and Spaced Repetition for scheduling.
 */

export interface TagMastery {
    score: number; // 0 to 1
    streak: number;
    lastSeenAt: number; // Timestamp
    nextDueAt: number;  // Timestamp
}

export interface Question {
    question_id: string;
    tags: string[];
    difficulty: number; // 1 to 5
    [key: string]: any;
}

// Alpha for EWMA. Higher means new answers change the score faster.
// We scale alpha by difficulty: 1 (0.1) to 5 (0.3)
const getAlpha = (difficulty: number) => 0.1 + (difficulty * 0.04);

/**
 * Calculates new mastery for a tag or family after an answer.
 * Formula: nuevo_mastery = (alpha * score) + (1 - alpha) * viejo_mastery
 * Scheduling:
 * - Incorrect: +1 day
 * - Correct (low mastery < 0.7): +3 days
 * - Correct (high mastery >= 0.7): +7 days
 * - Streak >= 3: +14 days
 * - Streak >= 5: +21 days
 */
export const calculateNextMastery = (
    current: TagMastery | undefined,
    isCorrect: boolean,
    difficulty: number
): TagMastery => {
    const defaultMastery: TagMastery = {
        score: 0.5,
        streak: 0,
        lastSeenAt: Date.now(),
        nextDueAt: Date.now()
    };

    const mastery = current || defaultMastery;
    const score = isCorrect ? 1 : 0;
    const alpha = getAlpha(difficulty);

    const newScore = (alpha * score) + (1 - alpha) * mastery.score;
    const newStreak = isCorrect ? mastery.streak + 1 : 0;
    
    // Phase 7 Scheduling Rules
    let bonusDays = 0;
    if (!isCorrect) {
        bonusDays = 1;
    } else {
        if (newStreak >= 5) {
            bonusDays = 21;
        } else if (newStreak >= 3) {
            bonusDays = 14;
        } else if (newScore >= 0.7) {
            bonusDays = 7;
        } else {
            bonusDays = 3;
        }
    }

    const nextDue = Date.now() + (bonusDays * 24 * 60 * 60 * 1000);

    return {
        score: newScore,
        streak: newStreak,
        lastSeenAt: Date.now(),
        nextDueAt: nextDue
    };
};

/**
 * Historical/Compatibility alias
 */
export const updateTagMastery = calculateNextMastery;

/**
 * Selects questions prioritizing due items and low mastery.
 * Ensures family_id uniqueness if requested.
 */
export const selectAdaptiveQuestions = <T extends Question>(
    allQuestions: T[],
    userMastery: Record<string, TagMastery>,
    limit: number = 20,
    uniqueFamilies: boolean = false
): T[] => {
    const now = Date.now();

    // Score each question
    const scoredQuestions = allQuestions.map(q => {
        let questionScore = 0;
        
        // Priority by tags
        if (q.tags && q.tags.length > 0) {
            const tagScores = q.tags.map(tag => {
                const m = userMastery[tag];
                if (!m) return 100;
                let priority = (1 - m.score) * 50;
                if (m.nextDueAt <= now) priority += 50;
                return priority;
            });
            questionScore = tagScores.reduce((a, b) => a + b, 0) / tagScores.length;
        }

        // Priority by family history (optional boost)
        if (q.family_id) {
            const fm = userMastery[`family_${q.family_id}`];
            if (fm) {
                if (fm.nextDueAt > now) questionScore -= 30; // Not due yet, lower priority
            }
        }

        return { ...q, priority: questionScore + (Math.random() * 5) };
    });

    // Sort by priority descending
    const sorted = scoredQuestions.sort((a, b: any) => b.priority - (a as any).priority);
    
    if (!uniqueFamilies) {
        return sorted.map(({ priority, ...q }) => q as unknown as T).slice(0, limit);
    }

    // Filter for unique families
    const selected: T[] = [];
    const usedFamilies = new Set<string>();

    for (const sq of sorted) {
        const { priority, ...q } = sq as any;
        if (q.family_id) {
            if (!usedFamilies.has(q.family_id)) {
                selected.push(q as unknown as T);
                usedFamilies.add(q.family_id);
            }
        } else {
            // No family, always okay
            selected.push(q as unknown as T);
        }
        if (selected.length >= limit) break;
    }

    return selected;
};

/**
 * Finds a variant of the current question (same family_id, different question_id).
 */
export const selectVariant = <T extends Question>(
    current: T,
    allQuestions: T[]
): T | undefined => {
    if (!current.family_id) return undefined;
    
    const variants = allQuestions.filter(q => 
        q.family_id === current.family_id && 
        q.question_id !== current.question_id
    );
    
    if (variants.length === 0) return undefined;
    
    // Return random variant
    return variants[Math.floor(Math.random() * variants.length)];
};
