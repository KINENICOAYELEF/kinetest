import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DailyCompliance {
    date: string; // YYYY-MM-DD
    responsesCount: number;
    tutorMinutes: number;
    isCompliant: boolean;
}

/**
 * Calculates compliance for a specific user and date range.
 */
export const getComplianceData = async (uid: string, startDate: Date, endDate: Date): Promise<DailyCompliance[]> => {
    // 1. Fetch attempts in range
    const attemptsQ = query(
        collection(db, 'users', uid, 'attempts'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
    );
    const attemptsSnap = await getDocs(attemptsQ);
    
    // 2. Fetch tutor sessions in range
    const sessionsQ = query(
        collection(db, 'sessions'),
        where('uid', '==', uid),
        where('mode', '==', 'tutor'),
        where('startedAt', '>=', Timestamp.fromDate(startDate)),
        where('startedAt', '<=', Timestamp.fromDate(endDate))
    );
    const sessionsSnap = await getDocs(sessionsQ);

    const complianceMap: Record<string, { responses: number; seconds: number }> = {};

    // Group attempts by day
    attemptsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            const dateStr = data.timestamp.toDate().toISOString().split('T')[0];
            if (!complianceMap[dateStr]) complianceMap[dateStr] = { responses: 0, seconds: 0 };
            complianceMap[dateStr].responses += 1;
        }
    });

    // Group tutor time by day
    sessionsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.startedAt && data.endedAt) {
            const dateStr = data.startedAt.toDate().toISOString().split('T')[0];
            const duration = data.endedAt.seconds - data.startedAt.seconds;
            if (!complianceMap[dateStr]) complianceMap[dateStr] = { responses: 0, seconds: 0 };
            complianceMap[dateStr].seconds += duration;
        }
    });

    // Convert map to array and fill missing days
    const results: DailyCompliance[] = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayData = complianceMap[dateStr] || { responses: 0, seconds: 0 };
        const tutorMinutes = Math.floor(dayData.seconds / 60);
        
        results.push({
            date: dateStr,
            responsesCount: dayData.responses,
            tutorMinutes,
            isCompliant: dayData.responses >= 18 || tutorMinutes >= 12
        });
        
        curr.setDate(curr.getDate() + 1);
    }

    return results;
};

export const calculateCompliancePercentage = (data: DailyCompliance[]): number => {
    if (data.length === 0) return 0;
    const compliantDays = data.filter(d => d.isCompliant).length;
    return Math.round((compliantDays / data.length) * 100);
};
