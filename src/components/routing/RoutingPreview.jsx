// src/components/routing/RoutingPreview.jsx
//
// "Where would this case go?" (ROUTING_RULES.md §6). Pick a report type, type
// sample answers and optionally an entity; POST /routing-rules/preview says
// which role takes it, the flags and tier, which rules applied, who would be
// assigned, and the steps. It writes nothing.
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import FlagBadge from '../reports/FlagBadge';
import { routingRulesAPI } from '../../api/routingRules';
import { localized } from '../../api/jurisdiction';
import { CONFIDENTIALITY_TIERS, normalizeOptions } from '../../utils/reportTypes';
import { describeError } from '../../utils/errors';
import { questionsOf } from './ruleUtils';

const control =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-line-accent focus:ring-2 focus:ring-accent-ring';

/** One sample answer input per question type. */
const AnswerInput = ({ question, value, onChange, id }) => {
  const { t } = useTranslation('routing');
  if (question.type === 'boolean') {
    return (
      <select id={id} className={control} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('preview.noAnswer')}</option>
        <option value="true">{t('preview.yes')}</option>
        <option value="false">{t('preview.no')}</option>
      </select>
    );
  }
  if (question.type === 'select' || question.type === 'multiselect') {
    const options = normalizeOptions(question.options);
    return (
      <select id={id} className={control} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('preview.noAnswer')}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
      </select>
    );
  }
  const numeric = ['number', 'currency'].includes(question.type);
  return (
    <input
      id={id}
      type={numeric ? 'number' : question.type === 'date' ? 'date' : 'text'}
      inputMode={numeric ? 'decimal' : undefined}
      dir="auto"
      className={control}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const RoutingPreview = ({ types = [], entities = [], nameFor = (c) => c }) => {
  const { t } = useTranslation('routing');
  const typeId = useId();
  const entityId = useId();
  const [reportTypeId, setReportTypeId] = useState('');
  const [entityCode, setEntityCode] = useState('');
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const type = types.find((ty) => ty.id === reportTypeId);
  const questions = useMemo(() => (type ? questionsOf([type]) : []), [type]);

  const run = async () => {
    if (!reportTypeId) return;
    // Only answered questions, in the type each one expects.
    const body = {};
    questions.forEach((q) => {
      const v = answers[q.name];
      if (v === undefined || v === '') return;
      if (q.type === 'boolean') body[q.name] = v === 'true';
      else if (q.type === 'multiselect') body[q.name] = [v];
      else if (['number', 'currency'].includes(q.type)) body[q.name] = Number(v);
      else body[q.name] = v;
    });
    setRunning(true);
    setError(null);
    try {
      setResult(await routingRulesAPI.preview({ report_type_id: reportTypeId, answers: body, entity_code: entityCode || null }));
    } catch (err) {
      setResult(null);
      setError(describeError(err).summary);
    } finally {
      setRunning(false);
    }
  };

  const tierLabel = (value) => CONFIDENTIALITY_TIERS.find((tier) => tier.value === value)?.label || value;

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-accent-fg" aria-hidden="true" />
          {t('preview.title')}
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <p className="text-sm text-ink-muted">{t('preview.intro')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={typeId} className="block text-sm font-medium text-ink-secondary">{t('preview.reportType')}</label>
            <select
              id={typeId}
              className={control}
              value={reportTypeId}
              onChange={(e) => {
                setReportTypeId(e.target.value);
                setAnswers({});
                setResult(null);
              }}
            >
              <option value="">{t('preview.chooseType')}</option>
              {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.code ? `${ty.code} · ${ty.name}` : ty.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={entityId} className="block text-sm font-medium text-ink-secondary">{t('preview.entity')}</label>
            <select id={entityId} className={control} value={entityCode} onChange={(e) => setEntityCode(e.target.value)}>
              <option value="">{t('preview.noEntity')}</option>
              {entities.map((e) => <option key={e.code} value={e.code}>{localized(e.name) || e.code}</option>)}
            </select>
          </div>
        </div>

        {questions.length > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-line-subtle p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-ink-muted">{t('preview.answers')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {questions.map((q) => {
                const id = `${typeId}-${q.name}`;
                return (
                  <div key={q.name} className="space-y-1">
                    <label htmlFor={id} className="block text-xs font-medium text-ink-secondary" dir="auto">
                      {q.label || q.name}
                      {q.type === 'currency' && <span className="ms-1 font-normal text-ink-muted">({t('preview.currencyUnits')})</span>}
                    </label>
                    <AnswerInput id={id} question={q} value={answers[q.name]} onChange={(v) => setAnswers((a) => ({ ...a, [q.name]: v }))} />
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        <Button onClick={run} isLoading={running} disabled={!reportTypeId}>{t('preview.run')}</Button>

        {error && <Alert variant="error">{error}</Alert>}

        {result && (
          <div className="space-y-3 rounded-lg border border-line bg-subtle p-4" aria-live="polite">
            {result.error && <Alert variant="warning">{result.error}</Alert>}
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-ink-secondary">{t('preview.owner')}</dt>
              <dd className="text-ink">
                <span dir="auto">{result.owner_role ? nameFor(result.owner_role) : t('preview.noOwner')}</span>
                {result.owner_source && (
                  <span className="ms-2 text-xs text-ink-muted">
                    {result.owner_source === 'rule' ? t('preview.fromRule') : t('preview.fromType')}
                  </span>
                )}
              </dd>
              {result.backup_role && (
                <>
                  <dt className="font-medium text-ink-secondary">{t('fields.backupRole')}</dt>
                  <dd dir="auto">{nameFor(result.backup_role)}</dd>
                </>
              )}
              <dt className="font-medium text-ink-secondary">{t('preview.tier')}</dt>
              <dd>{result.confidentiality_tier ? tierLabel(result.confidentiality_tier) : '—'}</dd>
              <dt className="font-medium text-ink-secondary">{t('preview.flags')}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {result.flags?.length ? result.flags.map((f) => <FlagBadge key={f.code} flag={f} />) : <span className="text-ink-muted">{t('values.none')}</span>}
              </dd>
              <dt className="font-medium text-ink-secondary">{t('preview.assignee')}</dt>
              <dd dir="auto">
                {result.assignee ? `${result.assignee.full_name || result.assignee.username} (${nameFor(result.assignee.role)})` : t('preview.queue')}
              </dd>
            </dl>
            {result.rules_applied?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">{t('preview.rulesApplied')}</p>
                <ul className="mt-1 space-y-1 text-sm text-ink-secondary">
                  {result.rules_applied.map((r) => (
                    <li key={r.rule_id}>
                      <span className="font-medium text-ink" dir="auto">{r.name}</span>{' '}
                      <span className="text-xs text-ink-muted">{t('preview.ruleMeta', { version: r.version, priority: r.priority })}</span>
                      {r.used?.length > 0 && <span className="ms-1 text-xs">· {r.used.map((u) => t(`used.${u}`, { defaultValue: u })).join(t('values.listSeparator'))}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">{t('preview.steps')}</p>
                {/* The steps are the server's sentences; the list follows their direction. */}
                <ol dir="auto" className="mt-1 list-decimal space-y-1 ps-5 text-sm text-ink-secondary">
                  {result.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default RoutingPreview;
