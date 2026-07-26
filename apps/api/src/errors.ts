export type PlanApiError = {
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
};
