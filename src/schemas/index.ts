import { z } from 'zod';

export const studentSchema = z.object({
  firstName: z.string().min(2, 'Το όνομα είναι υποχρεωτικό'),
  lastName: z.string().min(2, 'Το επώνυμο είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρο email').or(z.literal('')),
  phone: z.string().optional().default(''),
  birthDate: z.string().optional().default(''),
  guardianName: z.string().optional().default(''),
  guardianPhone: z.string().optional().default(''),
  classId: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'trial']),
  monthlyFee: z.coerce.number().min(0, 'Το μηνιαίο δίδακτρο πρέπει να είναι ≥ 0'),
  amka: z.string().optional(),
  gender: z.enum(['boy', 'girl', 'other', '']).optional(),
  fatherFirstName: z.string().optional(),
  motherFirstName: z.string().optional(),
  fatherEmail: z.string().optional(),
  motherEmail: z.string().optional(),
  motherPhone: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  clubName: z.string().optional(),
  registrationNumber: z.string().optional(),
  sport: z.string().optional(),
  healthCardStatus: z.string().optional(),
  healthCard: z.boolean().optional(),
  uniformReceived: z.boolean().optional(),
  uniformSize: z.string().optional(),
  registrationFee: z.coerce.number().optional(),
  registrationCharge: z.boolean().optional(),
  monthlyCharge: z.boolean().optional(),
  seasonTicket: z.boolean().optional(),
  subscriptionDiscount: z.boolean().optional(),
  discountAmount: z.coerce.number().optional(),
  discountReason: z.string().optional(),
  comments: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  gdprConsent: z.enum(['full', 'pending', 'locked']).optional(),
  gdprItems: z
    .object({
      personalData: z.boolean(),
      photoUse: z.boolean(),
      gallery: z.boolean(),
      communication: z.boolean(),
      medical: z.boolean(),
    })
    .optional(),
});

export const coachSchema = z.object({
  firstName: z.string().min(2, 'Το όνομα είναι υποχρεωτικό'),
  lastName: z.string().min(2, 'Το επώνυμο είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρο email'),
  phone: z.string().min(10, 'Μη έγκυρο τηλέφωνο'),
  sport: z.string().min(1, 'Επιλέξτε άθλημα'),
  active: z.boolean(),
});

export const classSchema = z.object({
  name: z.string().min(2, 'Το όνομα τμήματος είναι υποχρεωτικό'),
  sport: z.string().optional().default(''),
  ageGroup: z.string().optional().default(''),
  coachId: z.string().nullable().optional().default(null),
  maxStudents: z.coerce.number().int().min(1).optional().default(18),
  scheduleSummary: z.string().optional().default(''),
  monthlyFee: z.coerce.number().min(0).optional().default(55),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
});

export const scheduleSlotSchema = z.object({
  classId: z.string().min(1, 'Επιλέξτε τμήμα'),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().min(1, 'Ώρα έναρξης υποχρεωτική'),
  endTime: z.string().min(1, 'Ώρα λήξης υποχρεωτική'),
  location: z.string().min(1, 'Ο χώρος είναι υποχρεωτικός'),
});

export const revenueSchema = z.object({
  date: z.string().min(1, 'Η ημερομηνία είναι υποχρεωτική'),
  amount: z.coerce.number().positive('Το ποσό πρέπει να είναι θετικό'),
  category: z.enum(['tuition', 'registration', 'merchandise', 'events', 'other']),
  description: z.string().min(2, 'Η περιγραφή είναι υποχρεωτική'),
  studentId: z.string().optional(),
  paymentStatus: z.enum(['paid', 'pending', 'overdue']).default('paid'),
  subcategory: z.string().optional().default(''),
  clubName: z.string().optional().default(''),
  sport: z.string().optional().default(''),
  surname: z.string().optional().default(''),
  firstName: z.string().optional().default(''),
  subscriptionPeriod: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const matchExpenseDetailsSchema = z.object({
  sport: z.string().default(''),
  category: z.string().default(''),
  teams: z.string().default(''),
  referees: z.coerce.number().min(0).default(0),
  judges: z.coerce.number().min(0).default(0),
  travelAllowance: z.coerce.number().min(0).default(0),
  transportBus: z.coerce.number().min(0).default(0),
  transportPlane: z.coerce.number().min(0).default(0),
  transportShip: z.coerce.number().min(0).default(0),
  transportOther: z.coerce.number().min(0).default(0),
  accommodation: z.coerce.number().min(0).default(0),
  food: z.coerce.number().min(0).default(0),
});

export const expenseSchema = z.object({
  date: z.string().min(1, 'Η ημερομηνία είναι υποχρεωτική'),
  amount: z.coerce.number().positive('Το ποσό πρέπει να είναι θετικό'),
  category: z.enum(['rent', 'salaries', 'equipment', 'utilities', 'marketing', 'other']),
  description: z.string().min(2, 'Η περιγραφή είναι υποχρεωτική'),
  vendor: z.string().optional().default(''),
  subcategory: z.string().optional().default(''),
  clubName: z.string().optional().default(''),
  sport: z.string().optional().default(''),
  surname: z.string().optional().default(''),
  firstName: z.string().optional().default(''),
  studentId: z.string().optional(),
  notes: z.string().optional().default(''),
  matchDetails: matchExpenseDetailsSchema.optional(),
});

export type StudentInput = z.infer<typeof studentSchema>;
export type CoachInput = z.infer<typeof coachSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type ScheduleSlotInput = z.infer<typeof scheduleSlotSchema>;
export type RevenueInput = z.infer<typeof revenueSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const transactionSchema = z.object({
  athleteId: z.string().min(1, 'Επιλέξτε αθλητή'),
  amount: z.coerce.number().positive('Το ποσό πρέπει να είναι θετικό'),
  receiptNumber: z.string().optional().default(''),
  type: z.enum(['charge', 'payment']),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'viva', 'other', '']),
  comments: z.string().optional().default(''),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export const trainingSchema = z.object({
  date: z.string().min(1, 'Η ημερομηνία είναι υποχρεωτική'),
  startTime: z.string().min(1, 'Η ώρα έναρξης είναι υποχρεωτική'),
  endTime: z.string().min(1, 'Η ώρα λήξης είναι υποχρεωτική'),
  location: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  classId: z.string().nullable().optional(),
});

export type TrainingInput = z.infer<typeof trainingSchema>;

export const associationSchema = z.object({
  name: z.string().min(2, 'Το όνομα συλλόγου είναι υποχρεωτικό'),
  city: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().email('Μη έγκυρο email').or(z.literal('')).optional().default(''),
  address: z.string().optional().default(''),
  active: z.boolean().default(true),
});

export type AssociationInput = z.infer<typeof associationSchema>;

export const sportItemSchema = z.object({
  name: z.string().min(2, 'Το όνομα αθλήματος είναι υποχρεωτικό'),
  active: z.boolean().default(true),
});

export type SportItemInput = z.infer<typeof sportItemSchema>;

export const announcementSchema = z.object({
  title: z.string().min(2, 'Ο τίτλος είναι υποχρεωτικός'),
  message: z.string().min(2, 'Το μήνυμα είναι υποχρεωτικό'),
  targetType: z.enum(['club', 'team']).default('club'),
  targetId: z.string().nullable().optional().default(null),
  highPriority: z.boolean().optional().default(false),
  imageUrl: z.string().nullable().optional().default(null),
  visibleFrom: z.string().optional().default(''),
  visibleUntil: z.string().optional().default(''),
  showTo: z.string().optional().default(''),
  sportCategories: z.string().optional().default(''),
  teamsLabel: z.string().optional().default(''),
  audienceRoles: z
    .array(z.enum(['athletes', 'coaches', 'staff', 'parents']))
    .optional()
    .default([]),
  classIds: z.array(z.string()).optional().default([]),
  recipientIds: z
    .array(
      z.object({
        kind: z.enum(['athlete', 'coach', 'staff']),
        id: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const budgetSchema = z.object({
  seasonStart: z.coerce.number().int().min(2000),
  type: z.enum(['income', 'expense']),
  subcategory: z.string().min(1, 'Επιλέξτε υποκατηγορία'),
  amount: z.coerce.number().min(0, 'Το ποσό πρέπει να είναι ≥ 0'),
  clubName: z.string().optional().default(''),
  sport: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

export const PRODUCT_CATEGORIES = [
  'ΡΟΥΧΙΣΜΟΣ',
  'ΥΠΟΔΗΜΑΤΑ',
  'ΕΞΟΠΛΙΣΜΟΣ',
  'ΑΞΕΣΟΥΑΡ',
  'ΑΛΛΟ',
] as const;

export const warehouseProductSchema = z.object({
  name: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  category: z.string().min(1, 'Επιλέξτε κατηγορία'),
  sku: z.string().optional().default(''),
  salePrice: z.coerce.number().min(0, 'Η τιμή πρέπει να είναι ≥ 0'),
  size: z.string().optional().default(''),
  sizeGroup: z.enum(['kids', 'adult', '']).optional().default(''),
  notes: z.string().optional().default(''),
});

export type WarehouseProductInput = z.infer<typeof warehouseProductSchema>;

export const partnerBusinessSchema = z.object({
  name: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  url: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']),
  categories: z.string().optional().default(''),
  isSponsor: z.boolean().optional().default(false),
});

export type PartnerBusinessInput = z.infer<typeof partnerBusinessSchema>;

export const partnerOfferSchema = z.object({
  name: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  businessId: z.string().min(1, 'Επιλέξτε επιχείρηση'),
  status: z.enum(['active', 'inactive']),
});

export type PartnerOfferInput = z.infer<typeof partnerOfferSchema>;
