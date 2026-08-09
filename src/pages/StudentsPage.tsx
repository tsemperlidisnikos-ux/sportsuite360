import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import * as studentsService from '../api/services/studentsService';
import { AthletesIcon } from '../components/icons/AthletesIcon';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import type { StudentInput } from '../schemas';
import { studentStatusLabels } from '../utils/labels';

const draftAthlete: StudentInput = {
  firstName: 'ΝΕΟΣ',
  lastName: 'ΑΘΛΗΤΗΣ',
  email: '',
  phone: '',
  birthDate: '',
  guardianName: '',
  guardianPhone: '',
  classId: null,
  status: 'active',
  monthlyFee: 0,
  amka: '',
  gender: '',
  fatherFirstName: '',
  motherFirstName: '',
  fatherEmail: '',
  motherEmail: '',
  motherPhone: '',
  address: '',
  postalCode: '',
  city: '',
  clubName: '',
  registrationNumber: '',
  sport: '',
  healthCard: false,
  uniformReceived: false,
  uniformSize: '',
  registrationFee: 0,
  registrationCharge: true,
  monthlyCharge: true,
  seasonTicket: false,
  subscriptionDiscount: false,
  discountAmount: 0,
  discountReason: '',
  comments: '',
  photoUrl: null,
  gdprConsent: 'pending',
};

export function StudentsPage() {
  const navigate = useNavigate();
  const { data, refresh } = useAppData();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students.filter((s) => {
      if (!q) return true;
      const hay = `${s.firstName} ${s.lastName} ${s.email} ${s.guardianName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.students, query]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const result = await studentsService.createStudent(draftAthlete);
    setCreating(false);
    if (!result.success || !result.data) {
      window.alert(result.error ?? 'Αποτυχία δημιουργίας αθλητή');
      return;
    }
    refresh();
    navigate(`/athletes/${result.data.id}`, { state: { editing: true } });
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή αθλητή;')) return;
    await studentsService.deleteStudent(id);
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Αθλητές"
        subtitle="Μητρώο αθλητών, κηδεμόνες και σύνδεση με τμήματα."
        actions={
          <Button type="button" disabled={creating} onClick={() => void handleCreate()}>
            <Plus size={16} /> {creating ? 'Δημιουργία...' : 'Νέος αθλητής'}
          </Button>
        }
      />

      <div className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση αθλητή ή κηδεμόνα..."
          />
        </label>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αθλητής</th>
              <th>Τμήμα</th>
              <th>Κηδεμόνας</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const cls = data.classes.find((c) => c.id === student.classId);
              return (
                <tr
                  key={student.id}
                  className="clickable-row"
                  onClick={() => navigate(`/athletes/${student.id}`)}
                >
                  <td>
                    <div className="athlete-cell">
                      <span className="athlete-avatar" aria-hidden="true">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt="" />
                        ) : (
                          <AthletesIcon size={22} />
                        )}
                      </span>
                      <div>
                        <Link
                          to={`/athletes/${student.id}`}
                          className="athlete-name-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <strong>
                            {student.lastName} {student.firstName}
                          </strong>
                        </Link>
                        <div className="muted">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{cls?.name ?? '—'}</td>
                  <td>
                    {student.guardianName}
                    <div className="muted">{student.guardianPhone}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${student.status}`}>
                      {studentStatusLabels[student.status]}
                    </span>
                  </td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        navigate(`/athletes/${student.id}`, { state: { editing: true } })
                      }
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => void handleDelete(student.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
