'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RejectionList } from '@/components/domain/rejection-list';
import { PERSON_ROLE_LABELS } from '@/lib/domain';
import { PERSON_ROLES, type Person, type PersonRole } from '@/lib/types';
import { useVestigium, type Issue } from '@/store/use-vestigium';

const LABEL = 'text-[10px] font-mono uppercase tracking-widest text-muted-foreground';

const editSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi — tampil di seluruh dokumen (FR-M7-04).'),
  email: z.string().email('Email valid wajib — ia adalah identitas masuk (gerbang login).'),
  role: z.enum(PERSON_ROLES),
  organization: z.string().optional(),
  credentials: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

/** FR-M7-05 — koreksi profil personel. Invariant INV-18 melarang hapus personel yang
 *  direferensikan event, maka edit adalah satu-satunya jalur koreksi data orang.
 *  Perubahan peran mengubah hak akses berikutnya → detail audit dibuat eksplisit (GRU).
 *  Komponen di-mount ulang per personel (`key`) oleh pemanggil, sehingga nilai awal form
 *  berasal langsung dari `person` — tanpa efek sinkronisasi yang memicu re-render. */
export function PersonEditDialog({ person, open, onOpenChange, onSaved }: {
  person: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (message: string) => void;
}) {
  const updatePerson = useVestigium(s => s.updatePerson);
  const [issues, setIssues] = useState<Issue[]>([]);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: person.name, email: person.email ?? '',
      role: person.role, organization: person.organization, credentials: person.credentials,
    },
  });
  const role = useWatch({ control: form.control, name: 'role' });
  const roleChanged = role !== person.role;

  function onSubmit(v: EditForm) {
    setIssues([]);
    const r = updatePerson(person.id, {
      name: v.name, email: v.email, role: v.role as PersonRole,
      organization: v.organization ?? '', credentials: v.credentials ?? '',
    });
    if (!r.ok) { setIssues(r.issues); return; }
    onOpenChange(false);
    onSaved?.(`Profil ${r.data.name} diperbarui — perubahan tercatat di audit (PERSON_UPDATE).`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Personel</DialogTitle>
          <DialogDescription className="text-xs">
            Koreksi profil. Personel yang sudah terekam event tidak dapat dihapus — hanya
            dinonaktifkan (INV-18).{roleChanged && (
              <span className="font-semibold text-primary">
                {' '}Perubahan peran akan tercatat eksplisit di audit trail.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-name" className={LABEL}>Nama *</label>
            <Input id="edit-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>)}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-email" className={LABEL}>Email (identitas masuk) *</label>
            <Input id="edit-email" type="email" className="font-mono text-xs" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>)}
            <p className="text-[10px] text-muted-foreground">
              Email adalah kunci gerbang login — pastikan benar sebelum menyimpan.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className={LABEL}>Peran *</span>
              <Select items={PERSON_ROLE_LABELS} value={role}
                onValueChange={v => { if (v) form.setValue('role', v as EditForm['role']); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSON_ROLES.map(r => <SelectItem key={r} value={r}>{PERSON_ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-cred" className={LABEL}>Kredensial</label>
              <Input id="edit-cred" placeholder="mis. DEFR, CHFI" {...form.register('credentials')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-org" className={LABEL}>Organisasi</label>
            <Input id="edit-org" {...form.register('organization')} />
          </div>
          <RejectionList issues={issues} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit">Simpan Perubahan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
