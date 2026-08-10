import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import { studentSchema, type StudentInput } from '../../schemas';
import type { Student } from '../../types';
import { localDateIso } from '../../utils/dates';

export async function getStudents() {
  return apiClient(() => getData().students);
}

export async function createStudent(input: StudentInput) {
  return apiClient(() => {
    const parsed = studentSchema.parse(input);
    const student: Student = {
      ...parsed,
      id: createId('stu'),
      enrolledAt: localDateIso(),
    };
    mutateData((data) => {
      data.students.push(student);
    });
    return student;
  });
}

export async function updateStudent(id: string, input: StudentInput) {
  return apiClient(() => {
    const parsed = studentSchema.parse(input);
    let updated: Student | undefined;
    mutateData((data) => {
      const index = data.students.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Ο αθλητής δεν βρέθηκε');
      updated = { ...data.students[index], ...parsed };
      data.students[index] = updated;
    });
    return updated!;
  });
}

export async function deleteStudent(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.students = data.students.filter((s) => s.id !== id);
      data.attendance = data.attendance.filter((a) => a.studentId !== id);
    });
    return { id };
  });
}
