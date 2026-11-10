import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../context/AppConfigContext';
import { PORTAL } from '../../config/app';

// Applicant home: one guided checklist that always points at the next thing to do.
// All data comes from existing endpoints (profile, my applications, my challans, public settings).

const STATUS_BADGE = {
  submitted:    ['Submitted',    'bg-blue-50 text-blue-700'],
  under_review: ['Under review', 'bg-amber-50 text-amber-700'],
  approved:     ['Approved',     'bg-green-50 text-green-700'],
  rejected:     ['Not approved', 'bg-red-50 text-red-700'],
  withdrawn:    ['Withdrawn',    'bg-gray-100 text-gray-600'],
};

function Badge({ status }) {
  const [label, cls] = STATUS_BADGE[status] ?? [status, 'bg-gray-100 text-gray-600'];
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// state: done | current | locked | failed
function Step({ n, title, state, children, last }) {
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
        <p className={`font-medium ${state === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>{title}</p>
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
      completeness: p?.data?.completeness ?? null,
      applications: a ? list(a) : [],
      challans: c ? list(c) : [],
      admissionOpen: (s?.data?.settings?.admission_open ?? 'true') === 'true',
    }));
  }, []);

  if (!d) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const comp = d.completeness;
  const profileDone = !!comp?.complete;
  const active = d.applications.filter((x) => x.status !== 'withdrawn');
  const latest = active[0];                       // newest first from the API
  const approved = active.find((x) => x.status === 'approved');
  const openChallans = d.challans.filter((c) => !['paid', 'cancelled'].includes(c.status));
  const paidAny = d.challans.some((c) => c.status === 'paid');

  // Step states
  const sProfile  = profileDone ? 'done' : 'current';
  const sApply    = active.length ? 'done' : profileDone ? 'current' : 'locked';
  const sDecision = approved ? 'done' : latest?.status === 'rejected' && !approved ? 'failed' : latest ? 'current' : 'locked';
  const sPay      = approved ? (openChallans.length === 0 && paidAny ? 'done' : 'current') : 'locked';

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-1">Your admission at {app.name}. Follow the steps below.</p>
      </div>

      {!d.admissionOpen && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Admissions are currently closed. You can still complete your profile so you are ready when they open.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Your admission steps</h2>
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
