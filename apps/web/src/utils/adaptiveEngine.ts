export interface TagMastery {
    score: number;      // 0 to 1 (for UI progress)
    repetitions: number; // Counter for successful repetitions
    easeFactor: number; // SM-2 Ease Factor (default 2.5)
    interval: number;   // Days until next review
    lastSeenAt: number; // Timestamp
    nextDueAt: number;  // Timestamp
}

export interface Question {
    question_id: string;
    family_id?: string;
    tags: string[];
    difficulty: number; // 1 to 5
    [key: string]: any;
}

/**
 * Calculates new mastery using SM-2 Algorithm.
 * q (quality): 0-5 based on isCorrect and confidence.
 * Since we only have isCorrect now, we map:
 * Correct -> q=4 (good), Incorrect -> q=0 (blackout)
 */
export const calculateNextMastery = (
    current: TagMastery | undefined,
    isCorrect: boolean,
    difficulty: number // 1-5
): TagMastery => {
    const defaultMastery: TagMastery = {
        score: 0.5,
        repetitions: 0,
        easeFactor: 2.5,
        interval: 0,
        lastSeenAt: Date.now(),
        nextDueAt: Date.now()
    };

    const m = current || defaultMastery;
    
    // Map isCorrect to SM-2 Quality (0-5)
    // Later we can add a "How confident were you?" buttons to get real 0-5
    const q = isCorrect ? 4 : 0; 

    let { repetitions, easeFactor, interval } = m;

    if (q >= 3) { // Correct
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetitions++;
    } else { // Incorrect
        repetitions = 0;
        interval = 1;
    }

    // Update Ease Factor: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // UI Score adjustment (EWMA-like for smooth progress bars)
    const alpha = 0.2 + (difficulty * 0.05);
    const targetScore = isCorrect ? 1 : 0;
    const newScore = (alpha * targetScore) + (1 - alpha) * m.score;

    const nextDue = Date.now() + (interval * 24 * 60 * 60 * 1000);

    return {
        score: newScore,
        repetitions,
        easeFactor,
        interval,
        lastSeenAt: Date.now(),
        nextDueAt: nextDue
    };
};

export const updateTagMastery = calculateNextMastery;

/**
 * Selects questions prioritizing due items and low mastery.
 * If multiple variants exist for a family, it picks the one least seen (random for now).
 */
export const selectAdaptiveQuestions = <T extends Question>(
    allQuestions: T[],
    userMastery: Record<string, TagMastery>,
    limit: number = 20
): T[] => {
    const now = Date.now();

    // 1. Group questions by family
    const families: Record<string, T[]> = {};
    allQuestions.forEach(q => {
        const fid = q.family_id || `lone_${q.question_id}`;
        if (!families[fid]) families[fid] = [];
        families[fid].push(q);
    });

    // 2. Score each family
    const scoredFamilies = Object.keys(families).map(fid => {
        const familyQuestions = families[fid];
        const representative = familyQuestions[0];
        
        let priority = 0;
        
        // Priority based on tags
        if (representative.tags) {
            const tagScores = representative.tags.map(tag => {
                const m = userMastery[tag];
                if (!m) return 100; // New content
                let p = (1 - m.score) * 50;
                if (m.nextDueAt <= now) p += 50; // Overdue
                return p;
            });
            priority = tagScores.reduce((a, b) => a + b, 0) / (tagScores.length || 1);
        }

        // Priority boost if it's a family that hasn't been mastered yet
        const fm = userMastery[`family_${fid}`];
        if (fm) {
            if (fm.nextDueAt <= now) priority += 40;
            if (fm.score < 0.4) priority += 20;
        }

        return { fid, priority: priority + (Math.random() * 10) };
    });

    // 3. Sort families
    const sortedFamilies = scoredFamilies.sort((a, b) => b.priority - a.priority);

    // 4. Select best candidate from each top family
    const selected: T[] = [];
    for (const sf of sortedFamilies) {
        if (selected.length >= limit) break;
        
        const familyQuestions = families[sf.fid];
        // Pick a random variant (to avoid simple memoization)
        const variant = familyQuestions[Math.floor(Math.random() * familyQuestions.length)];
        selected.push(variant);
    }

    return selected;
};

/**
 * Historical/Simple variant selector
 */
export const selectVariant = <T extends Question>(
    current: T,
    allQuestions: T[]
): T | undefined => {
    if (!current.family_id) return undefined;
    const variants = allQuestions.filter(q => q.family_id === current.family_id && q.question_id !== current.question_id);
    if (variants.length === 0) return undefined;
    return variants[Math.floor(Math.random() * variants.length)];
};

