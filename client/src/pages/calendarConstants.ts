export type DayAgg = {
  _id: string;
  office: number;
  home: number;
  vacation: number;
  sick: number;
  off: number;
};

export const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
export const HEBREW_WEEKDAYS_FULL = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
];
