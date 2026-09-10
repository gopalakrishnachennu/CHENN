'use client';
import { useState } from 'react';
import { usePlatform } from '@/lib/platform-context';
import { autoAssignFamilyMatches } from '@/lib/matching-store';

export function FamilyAssignmentToggle() {
  const { state, user, act, refresh } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  if (!state) return null;
  return <section className="mb-5 rounded border bg-white p-5">
    <label className="flex items-center justify-between gap-4 font-semibold">
      Automatically assign family matches
      <input type="checkbox" role="switch" aria-label="Automatically assign family matches" checked={optimistic ?? state.settings.autoAssignFamilyMatches === true} disabled={busy} onChange={async e => {
        const enabled = e.target.checked;
        setOptimistic(enabled); setBusy(true); setMessage(enabled ? 'Enabled. Assigning existing family matches…' : 'Saving…');
        try {
          await act('settings.update', { settings: { ...state.settings, autoAssignFamilyMatches: enabled } });
          if (enabled && user) {
            const assigned = await autoAssignFamilyMatches(user);
            await refresh();
            setMessage(`Enabled. ${assigned} new family ${assigned === 1 ? 'match was' : 'matches were'} assigned.`);
          } else setMessage('Disabled. New assignments are manual; existing assignments are preserved.');
        } catch (error) { setOptimistic(null); setMessage(error instanceof Error ? error.message : 'Could not update automatic assignment.'); }
        finally { setBusy(false); setOptimistic(null); }
      }} className="h-5 w-5 accent-indigo-600" />
    </label>
    <p className="mt-2 text-sm text-slate-600">Assign candidates whose primary or approved secondary family matches an open, analyzed job. Turning this on also processes existing matches. Previously rejected assignments remain excluded.</p>
    <p className="mt-2 text-sm" role="status">{message}</p>
  </section>;
}
