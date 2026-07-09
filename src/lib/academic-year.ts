const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;

export function generateAcademicYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

export function isValidAcademicYear(value: string): boolean {
  return ACADEMIC_YEAR_REGEX.test(value);
}

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? year : year - 1;
  return generateAcademicYear(startYear);
}
