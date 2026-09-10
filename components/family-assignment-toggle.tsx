'use client';
import { useState } from 'react';
import { usePlatform } from '@/lib/platform-context';

export function FamilyAssignmentToggle() {
  const { state, act } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!state) return null;
  return <section className="mb-5 rounded border bg-white p-5">
    <label className="flex items-center justify-between gap-4 font-semibold">
      Automatically assign family matches
      <input type="checkbox" role="switch" aria-label="Automatically assign family matches" checked={state.settings.autoAssignFamilyMatches === true} disabled={busy} onChange={async e => {
        const enabled = e.target.checked;
        setBusy(true); setMessage('');
        try {
          await act('settings.update', { settings: { ...state.settings, autoAssignFamilyMatches: enabled } });
          setMessage(enabled ? 'Enabled. Matching candidates are assigned automatically.' : 'Disabled. New assignments are manual; existing assignments are preserved.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update automatic assignment.'); }
        finally { setBusy(false); }
      }} className="h-5 w-5 accent-indigo-600" />
    </label>
    <p className="mt-2 text-sm text-slate-600">Assign candidates whose primary or approved secondary family matches an open, analyzed job. Turning this on also processes existing matches. Previously rejected assignments remain excluded.</p>
    <p className="mt-2 text-sm" role="status">{busy ? 'Saving and processing family matches…' : message}</p>
  </section>;
}
