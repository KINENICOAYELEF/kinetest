/**
 * Calculates the Chilean grade (1.0 to 7.0) based on a percentage.
 * Exigencia (Requirement): 70% for a 4.0
 * 
 * Formula for % >= 70:
 * Grade = 4.0 + (Percentage - 70) * (3 / 30)
 * 
 * Formula for % < 70:
 * Grade = 1.0 + Percentage * (3 / 70)
 */
export const calculateChileanGrade = (scorePercent: number): number => {
    let grade: number;
    
    if (scorePercent >= 70) {
      grade = 4.0 + (scorePercent - 70) * (3 / 30);
    } else {
      grade = 1.0 + (scorePercent * (3 / 70));
    }
    
    // Round to 1 decimal place
    return Math.round(grade * 10) / 10;
  };
  
