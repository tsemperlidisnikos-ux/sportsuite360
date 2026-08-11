import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import * as photosService from '../api/services/photosService';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppData } from '../hooks/useAppData';
import { formatDate } from '../utils/labels';

const MAX_PHOTO_BYTES = 1_500_000;

export function PhotosPage() {
  const { data, refresh } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const photos = data.photos ?? [];

  function resetForm() {
    setFileName('');
    setImageUrl('');
    setCaption('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    setMessage('');
    if (!file) {
      setFileName('');
      setImageUrl('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Επιλέξτε εικόνα (JPG, PNG, WEBP).');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Η φωτογραφία πρέπει να είναι έως ~1.5MB.');
      event.target.value = '';
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => setError('Αποτυχία ανάγνωσης αρχείου.');
    reader.onload = () => setImageUrl(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!imageUrl) {
      setError('Επιλέξτε αρχείο φωτογραφίας.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const result = await photosService.createPhoto({
      imageUrl,
      caption,
      fileName,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα ανεβάσματος');
      return;
    }
    setMessage('Η φωτογραφία ανέβηκε.');
    resetForm();
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή φωτογραφίας;')) return;
    const result = await photosService.deletePhoto(id);
    if (!result.success) {
      setError(result.error ?? 'Σφάλμα διαγραφής');
      return;
    }
    refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader title="Φωτογραφίες" subtitle="Άλμπουμ φωτογραφιών συλλόγου." />

      <section className="panel photos-upload-panel">
        <form className="photos-upload-form" onSubmit={(e) => void handleUpload(e)}>
          <div className="photos-file-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
            />
            {fileName ? <span className="photos-file-name">{fileName}</span> : null}
          </div>
          <input
            className="field-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Λεζάντα"
          />
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Ανέβασμα…' : 'Ανέβασμα'}
            </Button>
          </div>
        </form>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      {photos.length === 0 ? (
        <p className="photos-empty muted">Δεν υπάρχουν φωτογραφίες.</p>
      ) : (
        <section className="photos-grid">
          {photos.map((photo) => (
            <article key={photo.id} className="photo-card">
              <img src={photo.imageUrl} alt={photo.caption || photo.fileName || 'Φωτογραφία'} />
              <div className="photo-card-body">
                <strong>{photo.caption || 'Χωρίς λεζάντα'}</strong>
                <span className="muted">
                  {photo.fileName || '—'} · {formatDate(photo.createdAt.slice(0, 10))}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleDelete(photo.id)}
                  aria-label="Διαγραφή"
                >
                  <Trash2 size={16} /> Διαγραφή
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
