import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../context/AppConfigContext';
import { PORTAL } from '../../config/app';

// Student home.
//  - Top: a student card (photo, program, Part/Semester, batch, shift, group, reg. no).
//  - Then four quick figures: fees due, next due date, challans paid, profile.
//  - Then the admission steps (folded away once everything is done).
// All data comes from existing endpoints (profile, my applications, my challans, public settings).

const STATUS_BADGE = {
  submitted:    ['Submitted',    'bg-blue-50 text-blue-700'],
  under_review: ['Under review', 'bg-amber-50 text-amber-700'],
  returned:     ['Returned for correction', 'bg-orange-50 text-orange-700'],
  approved:     ['Approved',     'bg-green-50 text-green-700'],
  rejected:     ['Not approved', 'bg-red-50 text-red-700'],
  withdrawn:    ['Withdrawn',    'bg-gray-100 text-gray-600'],
};

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const title = (s) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Badge({ status }) {
  const [label, cls] = STATUS_BADGE[status] ?? [status, 'bg-gray-100 text-gray-600'];
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Small icons (inline SVG, no extra package) ──
const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const I = {
  wallet:   'M3 7a2 2 0 012-2h12a2 2 0 012 2v1h1a1 1 0 011 1v6a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 5h.01',
  calendar: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  check:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  user:     'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  cap:      'M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6-3.5V12m12 4.5V12',
};

// Profile photo: the "photo" document, fetched with the auth header. Initials until it loads.
function Avatar({ doc, name }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!doc || !doc.mime_type?.startsWith('image/')) return;
    let made = null;
    api.get(`/profile/documents/${doc.id}/download`, { responseType: 'arraybuffer' })
      .then((r) => { made = URL.createObjectURL(new Blob([r.data], { type: doc.mime_type })); setUrl(made); })
      .catch(() => {});
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = (name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="w-24 h-28 sm:w-28 sm:h-32 shrink-0 rounded-xl overflow-hidden ring-4 ring-white/30 bg-white/15 flex items-center justify-center shadow-lg">
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-3xl font-bold text-white/90">{initials || '?'}</span>}
    </div>
  );
}

// One label/value pair on the card.
const Field = ({ label, value, muted }) => (
  <div className="min-w-0">
    <dt className="text-[11px] uppercase tracking-wider text-white/60">{label}</dt>
    <dd className={`mt-0.5 text-sm font-semibold truncate ${muted ? 'text-white/50 font-normal italic' : 'text-white'}`}>{value}</dd>
  </div>
);

function StudentCard({ user, profile, app, enrolment, groupLabel, photoDoc, completeness }) {
  const program = enrolment?.program;
  const partWord = program?.scheme === 'annual' ? 'Part' : 'Semester';
  const enrolled = !!enrolment;

  return (
    <section className="relative overflow-hidden rounded-2xl shadow-lg bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white">
      {/* soft decoration */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" aria-hidden="true" />

      {/* header strip: college + status */}
      <div className="relative flex items-center justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-3 min-w-0">
          {app.logo_url
            ? <img src={app.logo_url} alt="" className="w-9 h-9 rounded-lg p-1 object-contain" style={{ background: "#fff" }} />
            : <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"><Icon d={I.cap} /></span>}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{app.name}</p>
            <p className="text-[11px] uppercase tracking-widest text-white/60">Student Card</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
          enrolled ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40' : 'bg-white/15 text-white/90 ring-1 ring-white/25'
        }`}>
          {enrolled ? '● Enrolled' : 'Applicant'}
        </span>
      </div>

      <div className="relative flex flex-col sm:flex-row gap-6 px-6 pb-6 pt-5">
        <Avatar doc={photoDoc} name={user?.name} />

        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-tight truncate">{user?.name}</h2>
          {profile?.father_name && <p className="text-sm text-white/75 mt-0.5">Father: {profile.father_name}</p>}

          {enrolled ? (
            <>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium bg-white/10 rounded-lg px-3 py-1.5">
                <Icon d={I.cap} className="w-4 h-4" />
                <span className="truncate">{program?.name}</span>
              </p>
              <dl className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <Field label={partWord} value={enrolment.semester_no ? `${partWord} ${enrolment.semester_no}` : '—'} />
                <Field label="Batch" value={enrolment.admission_year || '—'} />
                <Field label="Shift" value={enrolment.shift ? title(enrolment.shift) : '—'} />
                <Field label="Group" value={groupLabel || 'Not recorded'} muted={!groupLabel} />
                <Field label="Registration No" value={profile?.registration_no || 'Not assigned yet'} muted={!profile?.registration_no} />
                <Field label="CNIC" value={user?.cnic_no || '—'} />
              </dl>
            </>
          ) : (
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
                <span>Admission profile</span><span className="font-semibold">{completeness?.percent ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${completeness?.percent ?? 0}%`, background: "#fff" }} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="CNIC" value={user?.cnic_no || '—'} />
                <Field label="Group" value={groupLabel || 'Not added yet'} muted={!groupLabel} />
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// One quick figure under the card.
function Stat({ icon, label, value, hint, tone = 'indigo', to }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    red:    'bg-red-50 text-red-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
  };
  const body = (
    <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4 transition hover:shadow-md hover:border-gray-300">
      <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon d={icon} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

// Admission steps. state: done | current | locked | failed
function Step({ n, title: t, state, children, last }) {
  const dot = {
    done:    'bg-green-600 text-white',
    current: 'bg-indigo-600 text-white ring-4 ring-indigo-100',
    locked:  'bg-gray-200 text-gray-500',
    failed:  'bg-red-600 text-white',
  }[state];
  return (
    <li className="relative flex gap-4">
      {!last && <span className="absolute left-4 top-9 -bottom-1 w-px bg-gray-200" aria-hidden="true" />}
      <span className={`relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${dot}`}>
        {state === 'done' ? '✓' : state === 'failed' ? '!' : n}
      </span>
      <div className="pb-7 min-w-0 flex-1">
        <p className={`font-medium ${state === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>{t}</p>
        {children && <div className="mt-1 text-sm text-gray-600">{children}</div>}
      </div>
    </li>
  );
}

const Btn = ({ to, children }) => (
  <Link to={to} className="inline-block mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
    {children}
  </Link>
);

export default function StudentDashboard() {
  const { user } = useAuth();
  const app = useAppConfig();
  const [d, setD] = useState(null);

  useEffect(() => {
    const list = (r) => r.data?.data ?? r.data ?? [];
    Promise.all([
      api.get('/profile').catch(() => null),
      api.get('/applications/my').catch(() => null),
      api.get('/challans/my').catch(() => null),
      api.get('/public/settings').catch(() => null),
    ]).then(([p, a, c, s]) => setD({
      profile: p?.data ?? null,
      completeness: p?.data?.completeness ?? null,
      applications: a ? list(a) : [],
      challans: c ? list(c) : [],
      admissionOpen: (s?.data?.settings?.admission_open ?? 'true') === 'true',
    }));
  }, []);

  if (!d) {
    return (
      <div className="max-w-7xl space-y-6 animate-pulse">
        <div className="h-60 rounded-2xl bg-gray-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => <div key={k} className="h-24 rounded-xl bg-gray-200" />)}
        </div>
      </div>
    );
  }

  const comp = d.completeness;
  const profileDone = !!comp?.complete;
  const active = d.applications.filter((x) => x.status !== 'withdrawn');
  const latest = active[0];                       // newest first from the API
  const approved = active.find((x) => x.status === 'approved');
  const returned = active.find((x) => x.status === 'returned');
  const openChallans = d.challans.filter((c) => !['paid', 'cancelled'].includes(c.status));
  const paidChallans = d.challans.filter((c) => c.status === 'paid');
  const paidAny = paidChallans.length > 0;

  // Card data
  const levels = d.profile?.levels ?? [];          // [{ key, label, groups ... }]
  const levelMeta = (k) => (Array.isArray(levels) ? levels.find((l) => l.key === k) : levels[k]);
  const eds = d.profile?.educations ?? [];
  // Group from the highest level that has groups (Intermediate before Matric).
  const groupEd = ['intermediate', 'matric']
    .map((lv) => eds.find((e) => e.level === lv && e.study_group))
    .find(Boolean) ?? eds.find((e) => e.study_group);
  const groupLabel = groupEd ? (levelMeta(groupEd.level)?.groups?.[groupEd.study_group] ?? title(groupEd.study_group)) : null;
  const photoDoc = (d.profile?.documents ?? []).find((x) => x.document_type === 'photo');

  // Figures
  const dueTotal = openChallans.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextDue = [...openChallans].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  const nextDueLate = nextDue && new Date(nextDue.due_date) < today;

  // Step states
  const sProfile  = profileDone ? 'done' : 'current';
  const sApply    = active.length ? 'done' : profileDone ? 'current' : 'locked';
  const sDecision = approved ? 'done' : latest?.status === 'rejected' && !approved ? 'failed' : latest ? 'current' : 'locked';
  const sPay      = approved ? (openChallans.length === 0 && paidAny ? 'done' : 'current') : 'locked';
  const allDone   = [sProfile, sApply, sDecision, sPay].every((s) => s === 'done');

  const steps = (
    <ol>
      <Step n={1} title="Create your account" state="done">
        Signed in with CNIC {user?.cnic_no}.
      </Step>

      <Step n={2} title="Complete your admission profile" state={sProfile}>
        {profileDone ? 'Personal details, education and documents are complete.' : (
          <>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${comp?.percent ?? 0}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-700">{comp?.percent ?? 0}%</span>
            </div>
            {comp?.missing?.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">{comp.missing.length} item{comp.missing.length > 1 ? 's' : ''} still needed.</p>
            )}
            <Btn to={`${PORTAL}/my-profile`}>Continue my profile</Btn>
          </>
        )}
      </Step>

      <Step n={3} title="Apply to a program" state={sApply}>
        {active.length ? (
          <>You have {active.length} application{active.length > 1 ? 's' : ''}.</>
        ) : profileDone ? (
          d.admissionOpen ? <>Your profile is ready. Choose a program and submit.<br /><Btn to={`${PORTAL}/apply`}>Apply now</Btn></>
                         : 'Admissions are closed right now.'
        ) : 'Available once your profile is complete.'}
      </Step>

      <Step n={4} title="Admission decision" state={sDecision}>
        {approved ? <>Approved for <b>{approved.program?.name}</b>.</>
          : latest?.status === 'rejected' ? <>Your application for {latest.program?.name} was not approved.{latest.remarks ? ` Reason: ${latest.remarks}` : ''}</>
          : returned ? <>
              Your application for <b>{returned.program?.name}</b> was returned for correction.
              {returned.correction_note ? <span className="block mt-1 text-orange-700">“{returned.correction_note}”</span> : null}
              <Btn to={`${PORTAL}/my-profile`}>Fix and resubmit</Btn>
            </>
          : latest ? <>{latest.program?.name}: <Badge status={latest.status} /> The admissions office will review it.</>
          : 'You will see the decision here after you apply.'}
      </Step>

      <Step n={5} title="Pay your fee challan" state={sPay} last>
        {!approved ? 'Your challan appears here after approval.'
          : openChallans.length ? <>You have {openChallans.length} unpaid challan{openChallans.length > 1 ? 's' : ''}.<br /><Btn to={`${PORTAL}/my-challans`}>View challan</Btn></>
          : paidAny ? 'Fee paid. Your admission is confirmed.'
          : 'Your challan is being prepared.'}
      </Step>
    </ol>
  );

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {approved ? `Here is your summary at ${app.name}.` : `Your admission at ${app.name}. Follow the steps below.`}
        </p>
      </div>

      {!d.admissionOpen && !approved && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Admissions are currently closed. You can still complete your profile so you are ready when they open.
        </div>
      )}

      <StudentCard
        user={user} profile={d.profile?.profile} app={app}
        enrolment={approved} groupLabel={groupLabel} photoDoc={photoDoc} completeness={comp}
      />

      {/* Quick figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={I.wallet} label="Fees due" to={`${PORTAL}/my-challans`}
          value={dueTotal > 0 ? money(dueTotal) : 'Nothing due'}
          hint={openChallans.length ? `${openChallans.length} unpaid challan${openChallans.length > 1 ? 's' : ''}` : 'You are all clear'}
          tone={dueTotal > 0 ? 'red' : 'green'} />
        <Stat icon={I.calendar} label="Next due date"
          value={nextDue ? fmtDate(nextDue.due_date) : '—'}
          hint={nextDue ? (nextDueLate ? 'Past due, late fee may apply' : (nextDue.title || title(nextDue.challan_type))) : 'No pending challans'}
          tone={nextDueLate ? 'red' : 'amber'} />
        <Stat icon={I.check} label="Challans paid" value={paidChallans.length}
          hint={paidAny ? `${money(paidChallans.reduce((s, c) => s + Number(c.total_amount || 0), 0))} in total` : 'None yet'} tone="green" />
        <Stat icon={I.user} label="Profile" to={`${PORTAL}/my-profile`}
          value={`${comp?.percent ?? 0}%`} hint={profileDone ? 'Complete' : 'Some items missing'}
          tone={profileDone ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admission steps: folded away once all done */}
        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          {allDone ? (
            <details>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-semibold">✓</span>
                  <span>
                    <span className="block font-semibold text-gray-900">Admission complete</span>
                    <span className="block text-sm text-gray-500">All five steps are done.</span>
                  </span>
                </span>
                <span className="text-xs font-medium text-indigo-600">Show steps</span>
              </summary>
              <div className="mt-6">{steps}</div>
            </details>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900 mb-5">Your admission steps</h2>
              {steps}
            </>
          )}
        </section>

        {/* Applications summary */}
        <aside className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My applications</h2>
            <Link to={`${PORTAL}/my-applications`} className="text-xs text-indigo-600 font-medium">View all</Link>
          </div>
          {d.applications.length === 0 ? (
            <p className="text-sm text-gray-500">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {d.applications.slice(0, 4).map((x) => (
                <li key={x.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{x.program?.name}</p>
                    <p className="text-xs text-gray-400">{x.application_no}</p>
                  </div>
                  <Badge status={x.status} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
