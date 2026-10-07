// src/components/reports/SkippedManagers.jsx
//
// Who escalation walked past on its way up, and why. Without it a case that
// lands three levels above the obvious manager looks like a bug — and an admin
// might "fix" an oversight level that was set up that way on purpose. The
// backend sends each as "Name (reason)", or a bare name on older responses.
import { CornerRightUp } from 'lucide-react';

// What each reason means and whether anything should change.
const EXPLAIN = [
  { test: /no case access/i, note: "Their account can't open cases. Change their role only if they're meant to handle them." },
  { test: /lowest level/i, note: 'The lowest level never receives cases. This is a fixed rule.' },
  { test: /not an escalation target/i, note: 'Their level is set as not an escalation target — a deliberate setting.' },
  { test: /not in the directory/i, note: 'Missing from the directory — add them, or correct their entry.' },
];

const parse = (entry) => {
  const match = /^(.*?)\s*\((.+)\)\s*$/.exec(String(entry));
  const name = match ? match[1] : String(entry);
  const reason = match ? match[2] : null;
  return { name, reason, note: reason ? EXPLAIN.find((e) => e.test.test(reason))?.note : null };
};

const SkippedManagers = ({ skipped }) => {
  if (!Array.isArray(skipped) || skipped.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-subtle px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
        <CornerRightUp className="h-3.5 w-3.5" aria-hidden="true" />
        Passed over on the way up
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {skipped.map(parse).map((person, index) => (
          <li key={index} className="text-xs">
            <span className="font-medium text-ink">{person.name}</span>
            {person.reason && <span className="text-ink-muted"> — {person.reason}</span>}
            {person.note && <span className="block text-ink-subtle">{person.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SkippedManagers;
