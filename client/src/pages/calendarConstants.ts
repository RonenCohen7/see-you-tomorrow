export type DayAgg = {
  _id: string;
  office: number;
  home: number;
  vacation: number;
  sick: number;
  off: number;
  /** Count of schedule rows authored via approved AI apply (same day may include manual rows too). */
  aiAssignments?: number;
};
