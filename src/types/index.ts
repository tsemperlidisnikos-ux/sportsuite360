export type StudentStatus = 'active' | 'inactive' | 'trial';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type ExpenseCategory =
  | 'rent'
  | 'salaries'
  | 'equipment'
  | 'utilities'
  | 'marketing'
  | 'other';
export type RevenueCategory =
  | 'tuition'
  | 'registration'
  | 'merchandise'
  | 'events'
  | 'other';
export type Gender = 'boy' | 'girl' | 'other' | '';
export type TransactionType = 'charge' | 'payment';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other' | '';

export interface AthleteTransaction {
  id: string;
  athleteId: string;
  amount: number;
  receiptNumber: string;
  type: TransactionType;
  month: number;
  year: number;
  paymentMethod: PaymentMethod;
  comments: string;
  createdAt: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  guardianName: string;
  guardianPhone: string;
  classId: string | null;
  status: StudentStatus;
  monthlyFee: number;
  enrolledAt: string;
  // Academio-style profile
  amka?: string;
  gender?: Gender;
  fatherFirstName?: string;
  motherFirstName?: string;
  fatherEmail?: string;
  motherEmail?: string;
  motherPhone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  clubName?: string;
  registrationNumber?: string;
  sport?: string;
  healthCardStatus?: string;
  healthCard?: boolean;
  uniformReceived?: boolean;
  uniformSize?: string;
  registrationFee?: number;
  registrationCharge?: boolean;
  monthlyCharge?: boolean;
  seasonTicket?: boolean;
  subscriptionDiscount?: boolean;
  discountAmount?: number;
  discountReason?: string;
  comments?: string;
  photoUrl?: string | null;
  gdprConsent?: 'full' | 'pending' | 'locked';
  gdprItems?: {
    personalData: boolean;
    photoUse: boolean;
    gallery: boolean;
    communication: boolean;
    medical: boolean;
  };
}

export interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sport: string;
  hireDate: string;
  active: boolean;
}

export interface AcademyClass {
  id: string;
  name: string;
  sport: string;
  ageGroup: string;
  coachId: string | null;
  maxStudents: number;
  scheduleSummary: string;
  monthlyFee: number;
  startDate?: string;
  endDate?: string;
}

export interface ScheduleSlot {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  present: boolean;
  notes?: string;
}

export interface Revenue {
  id: string;
  date: string;
  amount: number;
  category: RevenueCategory;
  description: string;
  studentId?: string;
  paymentStatus: PaymentStatus;
  subcategory?: string;
  clubName?: string;
  sport?: string;
  surname?: string;
  firstName?: string;
  subscriptionPeriod?: string;
  notes?: string;
}

export interface MatchExpenseDetails {
  sport: string;
  category: string;
  teams: string;
  referees: number;
  judges: number;
  travelAllowance: number;
  transportBus: number;
  transportPlane: number;
  transportShip: number;
  transportOther: number;
  accommodation: number;
  food: number;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  vendor?: string;
  subcategory?: string;
  clubName?: string;
  sport?: string;
  surname?: string;
  firstName?: string;
  studentId?: string;
  notes?: string;
  matchDetails?: MatchExpenseDetails;
}

export interface Training {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  classId: string | null;
}

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'admin' | 'coach' | 'secretariat';
  active: boolean;
  hireDate: string;
}

export interface Association {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface SportItem {
  id: string;
  name: string;
  active: boolean;
}

export type AnnouncementAudienceRole = 'athletes' | 'coaches' | 'staff' | 'parents';
export type AnnouncementRecipientKind = 'athlete' | 'coach' | 'staff';

export interface AnnouncementRecipient {
  kind: AnnouncementRecipientKind;
  id: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  targetType: 'club' | 'team';
  targetId: string | null;
  highPriority?: boolean;
  imageUrl?: string | null;
  visibleFrom?: string;
  visibleUntil?: string;
  showTo?: string;
  sportCategories?: string;
  teamsLabel?: string;
  audienceRoles?: AnnouncementAudienceRole[];
  classIds?: string[];
  recipientIds?: AnnouncementRecipient[];
}

export interface BudgetLine {
  id: string;
  seasonStart: number;
  type: 'income' | 'expense';
  subcategory: string;
  amount: number;
  clubName?: string;
  sport?: string;
  notes?: string;
}

export interface AppData {
  students: Student[];
  coaches: Coach[];
  classes: AcademyClass[];
  schedule: ScheduleSlot[];
  attendance: AttendanceRecord[];
  revenues: Revenue[];
  expenses: Expense[];
  transactions: AthleteTransaction[];
  trainings: Training[];
  staff: StaffMember[];
  associations: Association[];
  sports: SportItem[];
  announcements: Announcement[];
  budgets: BudgetLine[];
}
