export type UserRole = 'agent' | 'account_manager' | 'consultant' | 'admin';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  roles?: string[];
  avatar?: string;
  image?: string;
  score?: number;
  skills?: string[];
  bio?: string;
  assessmentSkipped?: boolean;
  isOnboarded?: boolean;
  isQuizPassed?: boolean;
  stats?: {
    tasksCompleted?: number;
    rating?: number;
    rank?: string;
  };
}
